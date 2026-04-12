export const VOICE_COUNT = 8;

export const DEFAULT_VOICE_NAMES = [
  "kick",
  "snare",
  "clap",
  "c-hat",
  "o-hat",
  "low-tom",
  "mid-tom",
  "hi-tom",
] as const;

export type VoiceName = string;

export interface KitVoiceSample {
  name: VoiceName;
  file: string;
}

export interface KitManifest {
  id: string;
  name: string;
  kind: "sample" | "synth";
  voices: KitVoiceSample[];
}

export interface LoadedVoice {
  name: VoiceName;
  type: "sample" | "synth";
  buffer?: AudioBuffer;
  synthVoice?: SynthVoiceKind;
}

export type SynthVoiceKind =
  | "kick"
  | "snare"
  | "clap"
  | "c-hat"
  | "o-hat"
  | "low-tom"
  | "mid-tom"
  | "hi-tom";

export const SYNTH_808_MANIFEST: KitManifest = {
  id: "synth-808",
  name: "Synth 808",
  kind: "synth",
  voices: DEFAULT_VOICE_NAMES.map((name) => ({ name, file: "" })),
};

export const SAMPLE_808_MANIFEST: KitManifest = {
  id: "sample-808",
  name: "TR-808 (samples)",
  kind: "sample",
  voices: [
    { name: "kick", file: "/kits/808/kick.wav" },
    { name: "snare", file: "/kits/808/snare.wav" },
    { name: "clap", file: "/kits/808/clap.wav" },
    { name: "c-hat", file: "/kits/808/c-hat.wav" },
    { name: "o-hat", file: "/kits/808/o-hat.wav" },
    { name: "low-tom", file: "/kits/808/low-tom.wav" },
    { name: "mid-tom", file: "/kits/808/mid-tom.wav" },
    { name: "hi-tom", file: "/kits/808/hi-tom.wav" },
  ],
};

export const BUILTIN_KITS: KitManifest[] = [SYNTH_808_MANIFEST, SAMPLE_808_MANIFEST];
