/**
 * Single source of truth for the Ocarina's physical buttons. The virtual
 * keyboard, configurator grid, and any future surface that needs to enumerate
 * or look up buttons all import from here.
 */

export interface ButtonDef {
  id: string;
  label: string;
  sublabel?: string;
  pin?: number;
  simKey?: string;
  source: "teensy" | "pi";
  group: "notes" | "latching" | "pi";
  /** If true, web click is a tap (down then up) rather than hold. */
  tap?: boolean;
}

export const NOTE_BUTTONS: ButtonDef[] = [
  { id: "C",  label: "C",  sublabel: "pin 34", pin: 34, simKey: "w", source: "teensy", group: "notes" },
  { id: "C#", label: "C#", sublabel: "pin 35", pin: 35, simKey: "e", source: "teensy", group: "notes" },
  { id: "D",  label: "D",  sublabel: "pin 36", pin: 36, simKey: "r", source: "teensy", group: "notes" },
  { id: "D#", label: "D#", sublabel: "pin 37", pin: 37, simKey: "t", source: "teensy", group: "notes" },
  { id: "E",  label: "E",  sublabel: "pin 38", pin: 38, simKey: "y", source: "teensy", group: "notes" },
  { id: "F",  label: "F",  sublabel: "pin 39", pin: 39, simKey: "u", source: "teensy", group: "notes" },
  { id: "F#", label: "F#", sublabel: "pin 40", pin: 40, simKey: "i", source: "teensy", group: "notes" },
  { id: "HA", label: "Harmony", sublabel: "pin 41", pin: 41, simKey: "o", source: "teensy", group: "notes", tap: true },
];

export const LATCHING_BUTTONS: ButtonDef[] = [
  { id: "Mt", label: "Mute",     sublabel: "pin 24", pin: 24, simKey: "a", source: "teensy", group: "latching", tap: true },
  { id: "Fn", label: "Fn",       sublabel: "pin 27", pin: 27, simKey: "f", source: "teensy", group: "latching", tap: true },
  { id: "Rv", label: "Reverb",   sublabel: "pin 28", pin: 28, simKey: "g", source: "teensy", group: "latching", tap: true },
  { id: "In", label: "Waveform", sublabel: "pin 29", pin: 29, simKey: "h", source: "teensy", group: "latching", tap: true },
  { id: "Dn", label: "Oct −",    sublabel: "pin 30", pin: 30, simKey: "j", source: "teensy", group: "latching", tap: true },
  { id: "Up", label: "Oct +",    sublabel: "pin 31", pin: 31, simKey: "k", source: "teensy", group: "latching", tap: true },
  { id: "Rc", label: "Record",   sublabel: "pin 32", pin: 32, simKey: "l", source: "teensy", group: "latching", tap: true },
];

export const PI_BUTTONS: ButtonDef[] = [
  { id: "INST1", label: "Inst 1", sublabel: "GPIO 17", pin: 17, source: "pi", group: "pi" },
  { id: "INST2", label: "Inst 2", sublabel: "GPIO 22", pin: 22, source: "pi", group: "pi" },
  { id: "INST3", label: "Inst 3", sublabel: "GPIO 23", pin: 23, source: "pi", group: "pi" },
  { id: "INST4", label: "Inst 4", sublabel: "GPIO 24", pin: 24, source: "pi", group: "pi" },
  { id: "VOICE", label: "Voice",  sublabel: "GPIO 25", pin: 25, source: "pi", group: "pi" },
];

export const ALL_BUTTONS: ButtonDef[] = [
  ...NOTE_BUTTONS,
  ...LATCHING_BUTTONS,
  ...PI_BUTTONS,
];

/** "A4" / "C#5" → "A" / "C#" */
export function resolveNoteButtonId(noteName: string): string | null {
  const root = noteName.replace(/[0-9]+$/, "").toUpperCase();
  return NOTE_BUTTONS.find((b) => b.id === root)?.id ?? null;
}

/** Pin → button id, scoped to source so Teensy pin 24 (Mute) and Pi GPIO 24 (Inst 4) don't collide. */
export function resolveButtonIdByPin(
  pin: number,
  source: "teensy" | "pi"
): string | null {
  const pool = source === "pi" ? PI_BUTTONS : [...NOTE_BUTTONS, ...LATCHING_BUTTONS];
  return pool.find((b) => b.pin === pin)?.id ?? null;
}
