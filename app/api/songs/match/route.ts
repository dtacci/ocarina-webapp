import { randomUUID } from "crypto";
import { generateObject } from "ai";

import { getModel, getProvider } from "@/lib/ai/provider";
import { songProfileSchema } from "@/lib/ai/schemas";
import { SONG_PROFILE_SYSTEM } from "@/lib/ai/prompts";
import { logAiInvocation } from "@/lib/ai/log-invocation";
import { logInteraction } from "@/lib/events/log";
import { createClient } from "@/lib/supabase/server";
import { getSong } from "@/lib/db/queries/songs";
import {
  matchInstrument,
  getCachedEnsemble,
  upsertEnsemble,
} from "@/lib/db/queries/match-ensemble";
import { pickDrumKit } from "@/lib/ensemble/drum-kit-select";
import type { EnsembleResult } from "@/lib/ensemble/types";
import type { Pattern } from "@/lib/audio/drum-engine";

export const maxDuration = 30;

interface PreviewFeaturesBody {
  bpm?: number;
  brightness?: number;
  energy?: number;
  drumPattern?: Pattern;
}

/**
 * POST /api/songs/match  { songId, previewFeatures? }
 *
 * The "sounds-like" core. The client resolves the song (GET /api/songs/[id])
 * and analyzes its preview locally, then posts the features here. We profile
 * the song (LLM structured output), match each instrument role to a library
 * sample (semantic, family fallback), attach a drum groove + best-fit kit, and
 * cache the whole ensemble. Mirrors app/api/ai/search/route.ts conventions.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const songId: unknown = body?.songId;
  if (!songId || typeof songId !== "string") {
    return Response.json({ error: "Missing songId" }, { status: 400 });
  }
  const previewFeatures = body?.previewFeatures as PreviewFeaturesBody | undefined;
  const queryId = randomUUID();

  // Cache hit → return immediately (no LLM, no matching).
  const cached = await getCachedEnsemble(songId);
  if (cached) {
    void logInteraction(
      { userId: user.id, source: "web" },
      { eventType: "ensemble_matched", queryId, payload: { song_id: songId, cached: true } },
    );
    return Response.json({ queryId, cached: true, ...cached });
  }

  const song = await getSong(songId);
  if (!song) {
    return Response.json(
      { error: "Unknown song — resolve via /api/songs/[id] first" },
      { status: 404 },
    );
  }

  // 1. Profile the song (LLM structured output), grounded by preview features.
  const provider = await getProvider();
  const model = await getModel("kit-builder");
  const started = Date.now();
  const bpm = previewFeatures?.bpm ?? song.deezer_bpm ?? 120;
  const prompt = [
    `Song: "${song.title}" by ${song.artist}.`,
    song.album ? `Album: ${song.album}.` : "",
    `Detected tempo: ~${bpm} BPM.`,
    previewFeatures?.brightness != null
      ? `Preview brightness: ${previewFeatures.brightness}/10, energy: ${previewFeatures.energy}/10.`
      : "",
    "Profile this song's instrumentation for recreation with the orchestral library.",
  ]
    .filter(Boolean)
    .join("\n");

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
      request: { songId, prompt },
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Profiling failed" }, { status: 502 });
  }

  // 2. Match each instrument role to a library sample (concurrently).
  const voices = await Promise.all(profile.instruments.map((inst) => matchInstrument(inst)));

  // 3. Drum part from the preview groove + a best-fit built-in kit.
  const hasGroove = previewFeatures?.drumPattern?.some((row) => row.some((s) => s.on)) ?? false;
  const drum: EnsembleResult["drum"] =
    previewFeatures?.drumPattern && hasGroove
      ? { kitId: pickDrumKit(profile), pattern: previewFeatures.drumPattern }
      : null;

  const result: EnsembleResult = { songId, bpm, profile, voices, drum, deepAnalyzed: false };
  void upsertEnsemble(result);

  void logAiInvocation({
    userId: user.id,
    feature: "kit-builder",
    provider,
    model: model.modelId,
    request: { songId, prompt },
    response: {
      genre: profile.genre,
      instrumentCount: profile.instruments.length,
      matched: voices.filter((v) => v.sampleId).length,
    },
    latencyMs: Date.now() - started,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  });
  void logInteraction(
    { userId: user.id, source: "web" },
    {
      eventType: "ensemble_matched",
      queryId,
      payload: {
        song_id: songId,
        genre: profile.genre,
        bpm,
        has_drums: drum != null,
        voices: voices.map((v) => ({ role: v.role, family: v.family, sample_id: v.sampleId })),
      },
    },
  );

  return Response.json({ queryId, cached: false, ...result });
}
