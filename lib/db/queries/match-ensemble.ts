import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, embeddingsAvailable } from "@/lib/ai/embedding";
import { semanticSampleSearch } from "@/lib/db/queries/semantic-search";
import type { SongProfile } from "@/lib/ai/schemas";
import {
  ANALYSIS_VERSION,
  type EnsembleResult,
  type EnsembleVoice,
} from "@/lib/ensemble/types";

/**
 * Match each profiled instrument role to a library sample, and read/write the
 * cached analysis. Service-role only (callers session-auth first). Mirrors the
 * hybrid-search graceful-degradation pattern: semantic ranking when an OpenAI
 * key is present, family-only fallback otherwise.
 */

type ProfileInstrument = SongProfile["instruments"][number];

interface Candidate {
  sampleId: string;
  title: string | null;
  url: string;
  score: number;
}

/** Cosine score below which a match is flagged as a loose "best guess". */
const BEST_GUESS_SCORE = 0.3;

async function samplesByFamily(family: string, limit: number): Promise<Candidate[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("samples")
    .select("id, title, mp3_blob_url")
    .eq("family", family)
    .not("mp3_blob_url", "is", null)
    .limit(limit);
  if (error) {
    console.error("samplesByFamily failed:", error.message);
    return [];
  }
  return (data ?? [])
    .filter((s) => s.mp3_blob_url)
    .map((s) => ({
      sampleId: s.id,
      title: s.title ?? null,
      url: s.mp3_blob_url as string,
      score: 0,
    }));
}

async function candidatesForRole(
  instrument: ProfileInstrument,
): Promise<{ candidates: Candidate[]; semantic: boolean }> {
  if (embeddingsAvailable()) {
    try {
      const embedding = await embedText(instrument.character);
      const results = await semanticSampleSearch(embedding, {
        family: instrument.family,
        limit: 5,
      });
      const candidates = results
        .filter((r) => r.mp3BlobUrl)
        .map((r) => ({
          sampleId: r.sampleId,
          title: r.title,
          url: r.mp3BlobUrl as string,
          score: r.score,
        }));
      if (candidates.length) return { candidates, semantic: true };
    } catch (err) {
      console.error("semantic match failed, falling back to family:", err);
    }
  }
  return { candidates: await samplesByFamily(instrument.family, 5), semantic: false };
}

export async function matchInstrument(instrument: ProfileInstrument): Promise<EnsembleVoice> {
  const { candidates, semantic } = await candidatesForRole(instrument);
  const best = candidates[0] ?? null;
  return {
    role: instrument.role,
    instrument: instrument.instrument,
    family: instrument.family,
    character: instrument.character,
    prominence: instrument.prominence,
    sampleId: best?.sampleId ?? null,
    sampleTitle: best?.title ?? null,
    url: best?.url ?? null,
    isBestGuess: !semantic || (best?.score ?? 0) < BEST_GUESS_SCORE,
    alternatives: candidates
      .slice(1, 4)
      .map((c) => ({ sampleId: c.sampleId, title: c.title, url: c.url })),
  };
}

export async function getCachedEnsemble(songId: string): Promise<EnsembleResult | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("song_ensembles")
    .select("bpm, profile_jsonb, ensemble_jsonb, drum_jsonb, deep_analyzed")
    .eq("song_id", songId)
    .eq("analysis_version", ANALYSIS_VERSION)
    .is("user_id", null)
    .maybeSingle();
  if (error) {
    console.error("getCachedEnsemble failed:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    songId,
    bpm: data.bpm,
    profile: data.profile_jsonb as EnsembleResult["profile"],
    voices: (data.ensemble_jsonb as EnsembleVoice[]) ?? [],
    drum: (data.drum_jsonb as EnsembleResult["drum"]) ?? null,
    deepAnalyzed: data.deep_analyzed,
  };
}

export async function upsertEnsemble(result: EnsembleResult): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("song_ensembles").upsert(
    {
      song_id: result.songId,
      user_id: null,
      analysis_version: ANALYSIS_VERSION,
      bpm: result.bpm,
      profile_jsonb: result.profile,
      ensemble_jsonb: result.voices,
      drum_jsonb: result.drum,
      deep_analyzed: result.deepAnalyzed,
    },
    { onConflict: "song_id,analysis_version" },
  );
  if (error) console.error("upsertEnsemble failed:", error.message);
}
