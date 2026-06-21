import type { SongProfile } from "@/lib/ai/schemas";
import type { Pattern } from "@/lib/audio/drum-engine";

/**
 * Bump when the analysis pipeline changes in a way that should invalidate the
 * song_ensembles cache (profile prompt, matching logic, DSP). Mirrors the
 * parser_version pattern used by transcription renders.
 */
export const ANALYSIS_VERSION = 1;

/** One matched instrument role: the profiled part + the library sample we picked. */
export interface EnsembleVoice {
  role: string;
  instrument: string;
  family: string;
  character: string;
  prominence: number;
  sampleId: string | null;
  sampleTitle: string | null;
  url: string | null; // mp3 preview url, playable in the browser
  /** True when the match is a loose approximation (weak score / family fallback). */
  isBestGuess: boolean;
  alternatives: Array<{ sampleId: string; title: string | null; url: string }>;
}

export interface EnsembleDrum {
  kitId: string; // a built-in kit id (drum-kit-manifest)
  pattern: Pattern; // 16-step groove from the preview analysis
}

/** A generated groove handed from the workshop into the drum step sequencer. */
export interface IncomingGroove {
  kitId: string;
  pattern: Pattern;
  bpm: number;
}

export interface EnsembleResult {
  songId: string;
  bpm: number;
  profile: SongProfile;
  voices: EnsembleVoice[];
  drum: EnsembleDrum | null;
  deepAnalyzed: boolean;
}
