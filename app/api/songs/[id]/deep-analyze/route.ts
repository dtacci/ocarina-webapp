import { randomUUID } from "crypto";
import { generateObject } from "ai";

import { getModel, getProvider } from "@/lib/ai/provider";
import { songProfileSchema } from "@/lib/ai/schemas";
import { SONG_PROFILE_SYSTEM } from "@/lib/ai/prompts";
import { logAiInvocation } from "@/lib/ai/log-invocation";
import { logInteraction } from "@/lib/events/log";
import { createClient } from "@/lib/supabase/server";
import { getDeezerTrack, deezerSongId } from "@/lib/deezer";
import { getSong, parseDeezerSongId } from "@/lib/db/queries/songs";
import {
  matchInstrument,
  getCachedEnsemble,
  upsertEnsemble,
} from "@/lib/db/queries/match-ensemble";
import { stemSeparationAvailable, separateStems } from "@/lib/stems";
import type { EnsembleResult } from "@/lib/ensemble/types";

export const maxDuration = 120;

/**
 * POST /api/songs/[id]/deep-analyze
 *
 * The optional "ground truth" path: separate the preview into stems (Demucs via
 * Replicate), then re-profile + re-match with that context so the bassline and
 * harmonic parts are read from the recording rather than the model's memory.
 * Config-gated — returns 503 when stem separation isn't set up, so the fast path
 * is unaffected. Reuses the fast-pass drum groove from the cache.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!stemSeparationAvailable()) {
    return Response.json({ error: "Deep analyze not configured" }, { status: 503 });
  }

  const { id } = await params;
  const deezerId = parseDeezerSongId(decodeURIComponent(id));
  if (deezerId == null) {
    return Response.json({ error: "Unsupported song id" }, { status: 400 });
  }
  const songId = deezerSongId(deezerId);

  const song = await getSong(songId);
  if (!song) {
    return Response.json({ error: "Run analyze first" }, { status: 404 });
  }
  const track = await getDeezerTrack(deezerId);
  if (!track?.previewUrl) {
    return Response.json({ error: "No preview available" }, { status: 404 });
  }

  let stems;
  try {
    stems = await separateStems(track.previewUrl);
  } catch (err) {
    console.error("stem separation failed:", err);
    return Response.json({ error: "Stem separation failed" }, { status: 502 });
  }
  const presentStems = Object.entries(stems)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const cached = await getCachedEnsemble(songId);
  const bpm = cached?.bpm ?? song.deezer_bpm ?? 120;

  // Re-profile with stem context, then re-match each instrument.
  const provider = await getProvider();
  const model = await getModel("kit-builder");
  const started = Date.now();
  const prompt = [
    `Song: "${song.title}" by ${song.artist}.`,
    `Detected tempo: ~${bpm} BPM.`,
    `Stem separation isolated these parts from the actual recording: ${presentStems.join(", ")}.`,
    "Profile precisely from these stems — especially the bassline and the harmonic/melodic ('other') content.",
  ].join("\n");

  let profile;
  let usage;
  try {
    const result = await generateObject({
      model,
      schema: songProfileSchema,
      system: SONG_PROFILE_SYSTEM,
      prompt,
    });
    profile = result.object;
    usage = result.usage;
  } catch (err) {
    void logAiInvocation({
      userId: user.id,
      feature: "kit-builder",
      provider,
      model: model.modelId,
      request: { songId, prompt, deep: true },
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Profiling failed" }, { status: 502 });
  }

  const voices = await Promise.all(profile.instruments.map((inst) => matchInstrument(inst)));
  const result: EnsembleResult = {
    songId,
    bpm,
    profile,
    voices,
    drum: cached?.drum ?? null,
    deepAnalyzed: true,
  };
  void upsertEnsemble(result);

  void logAiInvocation({
    userId: user.id,
    feature: "kit-builder",
    provider,
    model: model.modelId,
    request: { songId, prompt, deep: true },
    response: { stems: presentStems, matched: voices.filter((v) => v.sampleId).length },
    latencyMs: Date.now() - started,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  });
  void logInteraction(
    { userId: user.id, source: "web" },
    {
      eventType: "ensemble_deep_analyzed",
      queryId: randomUUID(),
      payload: { song_id: songId, stems: presentStems },
    },
  );

  return Response.json(result);
}
