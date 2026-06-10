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
