/**
 * Serialized shape of a track-editor mix (session_mixes.channels / .master).
 * Chains reuse the sample editor's EffectNode vocabulary — same JSON the
 * `samples.edit_spec` column stores.
 */
import type { EffectNode } from "./editor-types";

export interface MixChannelSpec {
  recordingId: string;
  /** Denormalized stem label for display ("Track 1", stem title, …). */
  label: string;
  /** Linear fader, 0..1.5 (1 = unity). */
  volume: number;
  /** -1 (L) .. 1 (R). */
  pan: number;
  muted: boolean;
  soloed: boolean;
  chain: EffectNode[];
}

export interface MixMasterSpec {
  volume: number;
}

export interface SessionMixDoc {
  name: string;
  channels: MixChannelSpec[];
  master: MixMasterSpec;
  /** Clip timeline (phase B); null/absent = whole-stem loop mix. */
  arrangement?: Arrangement | null;
}

export function defaultChannelSpec(recordingId: string, label: string): MixChannelSpec {
  return {
    recordingId,
    label,
    volume: 1,
    pan: 0,
    muted: false,
    soloed: false,
    chain: [],
  };
}

export const DEFAULT_MASTER: MixMasterSpec = { volume: 1 };

// ── Clip arrangement (phase B) ──────────────────────────────────────────────

export interface ArrangementClip {
  /** Stem this clip plays (a lane's channel recording). */
  recordingId: string;
  /** Timeline position of the clip's left edge, seconds. */
  startSec: number;
  /** Offset into the source stem, seconds (left-edge trim). */
  offsetSec: number;
  /** Clip length on the timeline, seconds. */
  durationSec: number;
}

export interface ArrangementLane {
  recordingId: string;
  clips: ArrangementClip[];
}

export interface Arrangement {
  /** Session tempo for the snap grid; null disables beat snapping. */
  bpm: number | null;
  /** Snap division in beats (4 = bar in 4/4, 1 = beat). 0 = free. */
  gridBeats: number;
  lanes: ArrangementLane[];
}

/** One clip per stem at t=0, full length — the "as recorded" layout. */
export function defaultArrangement(
  stems: { id: string; durationSec: number }[],
  bpm: number | null,
): Arrangement {
  return {
    bpm,
    gridBeats: 4,
    lanes: stems.map((s) => ({
      recordingId: s.id,
      clips: [{ recordingId: s.id, startSec: 0, offsetSec: 0, durationSec: s.durationSec }],
    })),
  };
}

export function arrangementLengthSec(arr: Arrangement): number {
  let end = 0;
  for (const lane of arr.lanes) {
    for (const c of lane.clips) end = Math.max(end, c.startSec + c.durationSec);
  }
  return end;
}
