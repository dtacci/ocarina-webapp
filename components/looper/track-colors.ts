export const TRACK_COLORS = [
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
] as const;

export type TrackColor = (typeof TRACK_COLORS)[number];

export const TRACK_BG_TINTS: Record<string, string> = {
  "bg-emerald-500": "bg-emerald-950/40",
  "bg-amber-500": "bg-amber-950/40",
  "bg-rose-500": "bg-rose-950/40",
  "bg-sky-500": "bg-sky-950/40",
  "bg-violet-500": "bg-violet-950/40",
  "bg-orange-500": "bg-orange-950/40",
  "bg-teal-500": "bg-teal-950/40",
  "bg-pink-500": "bg-pink-950/40",
};

export const TRACK_SOLO_BORDERS: Record<string, string> = {
  "bg-emerald-500": "border-l-emerald-500",
  "bg-amber-500": "border-l-amber-500",
  "bg-rose-500": "border-l-rose-500",
  "bg-sky-500": "border-l-sky-500",
  "bg-violet-500": "border-l-violet-500",
  "bg-orange-500": "border-l-orange-500",
  "bg-teal-500": "border-l-teal-500",
  "bg-pink-500": "border-l-pink-500",
};

export const TRACK_STEP_FILL: Record<string, string> = {
  "bg-emerald-500": "bg-emerald-400",
  "bg-amber-500": "bg-amber-400",
  "bg-rose-500": "bg-rose-400",
  "bg-sky-500": "bg-sky-400",
  "bg-violet-500": "bg-violet-400",
  "bg-orange-500": "bg-orange-400",
  "bg-teal-500": "bg-teal-400",
  "bg-pink-500": "bg-pink-400",
};

export const TRACK_STEP_RING: Record<string, string> = {
  "bg-emerald-500": "ring-emerald-400/70",
  "bg-amber-500": "ring-amber-400/70",
  "bg-rose-500": "ring-rose-400/70",
  "bg-sky-500": "ring-sky-400/70",
  "bg-violet-500": "ring-violet-400/70",
  "bg-orange-500": "ring-orange-400/70",
  "bg-teal-500": "ring-teal-400/70",
  "bg-pink-500": "ring-pink-400/70",
};
