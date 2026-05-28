/**
 * Action vocabulary for the button configurator. The web app stores these in
 * device_configs.config_json.buttons; Pi-side firmware reads the same shape to
 * decide what each physical button does at runtime.
 *
 * Adding a new action: add a union variant, add a metadata entry to
 * ACTION_DEFS, and Pi will need a matching handler.
 */

export type ButtonAction =
  | { action: "note"; note: string }                      // play a fixed note (e.g. "C", "F#")
  | { action: "track_select"; track: number }             // 1..6 looper tracks
  | { action: "expression"; param: string }               // "volume_up" | "harmony" | "octave_up" | ...
  | { action: "mute" }
  | { action: "octave_up" }
  | { action: "octave_down" }
  | { action: "record" }
  | { action: "mic_toggle" }
  | { action: "nop" };

export type ActionKind = ButtonAction["action"];

export interface ActionDef {
  kind: ActionKind;
  label: string;
  description: string;
  /** Tailwind class fragment for tile accent. */
  color: string;
  /** If the action carries a parameter, describe it for the picker. */
  param?: {
    key: string;
    label: string;
    /** When omitted, free text input. */
    options?: { value: string | number; label: string }[];
    type?: "string" | "number";
  };
}

export const ACTION_DEFS: ActionDef[] = [
  {
    kind: "note",
    label: "Note",
    description: "Play a fixed pitch",
    color: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
    param: {
      key: "note",
      label: "Pitch",
      type: "string",
      options: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map(
        (n) => ({ value: n, label: n })
      ),
    },
  },
  {
    kind: "track_select",
    label: "Track select",
    description: "Switch the looper to a track",
    color: "border-blue-500/50 bg-blue-500/10 text-blue-200",
    param: {
      key: "track",
      label: "Track",
      type: "number",
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `Track ${n}` })),
    },
  },
  {
    kind: "expression",
    label: "Expression",
    description: "Volume, octave, harmony, etc.",
    color: "border-violet-500/50 bg-violet-500/10 text-violet-200",
    param: {
      key: "param",
      label: "Effect",
      type: "string",
      options: [
        { value: "volume_up", label: "Volume +" },
        { value: "volume_down", label: "Volume −" },
        { value: "octave_up", label: "Octave +" },
        { value: "octave_down", label: "Octave −" },
        { value: "harmony", label: "Harmony" },
        { value: "reverb", label: "Reverb" },
      ],
    },
  },
  {
    kind: "mute",
    label: "Mute",
    description: "Mute the output",
    color: "border-amber-500/50 bg-amber-500/10 text-amber-200",
  },
  {
    kind: "octave_up",
    label: "Octave +",
    description: "Shift up one octave",
    color: "border-cyan-500/50 bg-cyan-500/10 text-cyan-200",
  },
  {
    kind: "octave_down",
    label: "Octave −",
    description: "Shift down one octave",
    color: "border-cyan-500/50 bg-cyan-500/10 text-cyan-200",
  },
  {
    kind: "record",
    label: "Record",
    description: "Arm / commit a track",
    color: "border-red-500/50 bg-red-500/10 text-red-200",
  },
  {
    kind: "mic_toggle",
    label: "Mic toggle",
    description: "Enable / disable the microphone",
    color: "border-pink-500/50 bg-pink-500/10 text-pink-200",
  },
  {
    kind: "nop",
    label: "Unassigned",
    description: "Button does nothing",
    color: "border-border bg-card/40 text-muted-foreground",
  },
];

export function actionDef(kind: ActionKind): ActionDef {
  return ACTION_DEFS.find((d) => d.kind === kind) ?? ACTION_DEFS[ACTION_DEFS.length - 1];
}

export function describeAction(a: ButtonAction): string {
  switch (a.action) {
    case "note":          return `Note ${a.note}`;
    case "track_select":  return `Track ${a.track}`;
    case "expression":    return a.param.replace(/_/g, " ");
    case "mute":          return "Mute";
    case "octave_up":     return "Octave +";
    case "octave_down":   return "Octave −";
    case "record":        return "Record";
    case "mic_toggle":    return "Mic";
    case "nop":           return "—";
  }
}
