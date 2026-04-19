"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Every hardware/simulated button the Pi can report or receive. `simKey` is
 * the ASCII byte the Teensy's `processSerialKeys()` already recognises —
 * clicking this button on the web sends that same byte down the serial cable,
 * so we exercise the exact same handler as a physical press.
 *
 * Buttons sourced from firmware/teensy/pitch_detection_v7/*.h and
 * pi/main.py GPIO pins.
 */
interface ButtonDef {
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

const NOTE_BUTTONS: ButtonDef[] = [
  { id: "C",  label: "C",  sublabel: "pin 34", pin: 34, simKey: "w", source: "teensy", group: "notes" },
  { id: "C#", label: "C#", sublabel: "pin 35", pin: 35, simKey: "e", source: "teensy", group: "notes" },
  { id: "D",  label: "D",  sublabel: "pin 36", pin: 36, simKey: "r", source: "teensy", group: "notes" },
  { id: "D#", label: "D#", sublabel: "pin 37", pin: 37, simKey: "t", source: "teensy", group: "notes" },
  { id: "E",  label: "E",  sublabel: "pin 38", pin: 38, simKey: "y", source: "teensy", group: "notes" },
  { id: "F",  label: "F",  sublabel: "pin 39", pin: 39, simKey: "u", source: "teensy", group: "notes" },
  { id: "F#", label: "F#", sublabel: "pin 40", pin: 40, simKey: "i", source: "teensy", group: "notes" },
  { id: "HA", label: "Harmony", sublabel: "pin 41", pin: 41, simKey: "o", source: "teensy", group: "notes", tap: true },
];

const LATCHING_BUTTONS: ButtonDef[] = [
  { id: "Mt", label: "Mute",    sublabel: "pin 24", pin: 24, simKey: "a", source: "teensy", group: "latching", tap: true },
  { id: "Fn", label: "Fn",      sublabel: "pin 27", pin: 27, simKey: "f", source: "teensy", group: "latching", tap: true },
  { id: "Rv", label: "Reverb",  sublabel: "pin 28", pin: 28, simKey: "g", source: "teensy", group: "latching", tap: true },
  { id: "In", label: "Waveform", sublabel: "pin 29", pin: 29, simKey: "h", source: "teensy", group: "latching", tap: true },
  { id: "Dn", label: "Oct −",   sublabel: "pin 30", pin: 30, simKey: "j", source: "teensy", group: "latching", tap: true },
  { id: "Up", label: "Oct +",   sublabel: "pin 31", pin: 31, simKey: "k", source: "teensy", group: "latching", tap: true },
  { id: "Rc", label: "Record",  sublabel: "pin 32", pin: 32, simKey: "l", source: "teensy", group: "latching", tap: true },
];

const PI_BUTTONS: ButtonDef[] = [
  { id: "INST1", label: "Inst 1", sublabel: "GPIO 17", pin: 17, source: "pi", group: "pi" },
  { id: "INST2", label: "Inst 2", sublabel: "GPIO 22", pin: 22, source: "pi", group: "pi" },
  { id: "INST3", label: "Inst 3", sublabel: "GPIO 23", pin: 23, source: "pi", group: "pi" },
  { id: "INST4", label: "Inst 4", sublabel: "GPIO 24", pin: 24, source: "pi", group: "pi" },
  { id: "VOICE", label: "Voice",  sublabel: "GPIO 25", pin: 25, source: "pi", group: "pi" },
];

export interface VirtualKeyboardProps {
  /** Set of button ids currently pressed on the physical device. */
  activePhysical: Set<string>;
  /** Most recently active note id (flash highlight). */
  flashNote: string | null;
  /** Device id for sending sim_key commands. Null disables interactive mode. */
  deviceId: string | null;
  /**
   * True only when the Teensy is confirmed attached and streaming telemetry.
   * When false, Teensy button rows render disabled (sim_key has nothing to
   * reach). Pi GPIO row stays enabled whenever a deviceId exists.
   */
  teensyInteractive: boolean;
}

export function VirtualKeyboard({
  activePhysical,
  flashNote,
  deviceId,
  teensyInteractive,
}: VirtualKeyboardProps) {
  const [clickPressed, setClickPressed] = useState<Set<string>>(new Set());
  const activeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sendSim = useCallback(
    async (key: string, event: "down" | "up" | "tap") => {
      if (!deviceId) return;
      try {
        await fetch("/api/sync/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            command: "sim_key",
            params: { key, event },
          }),
        });
      } catch {
        // Silent — the live event log will show absence of echo if it failed.
      }
    },
    [deviceId]
  );

  const handleDown = useCallback(
    (btn: ButtonDef) => {
      if (!btn.simKey || !deviceId) return;
      setClickPressed((prev) => new Set(prev).add(btn.id));
      if (btn.tap) {
        void sendSim(btn.simKey, "tap");
        // Visual press lasts 150ms for tap-style controls.
        const t = setTimeout(() => {
          setClickPressed((prev) => {
            const next = new Set(prev);
            next.delete(btn.id);
            return next;
          });
          activeTimers.current.delete(btn.id);
        }, 150);
        activeTimers.current.set(btn.id, t);
      } else {
        void sendSim(btn.simKey, "down");
      }
    },
    [sendSim, deviceId]
  );

  const handleUp = useCallback(
    (btn: ButtonDef) => {
      if (!btn.simKey || btn.tap || !deviceId) return;
      void sendSim(btn.simKey, "up");
      setClickPressed((prev) => {
        const next = new Set(prev);
        next.delete(btn.id);
        return next;
      });
    },
    [sendSim, deviceId]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-medium">Virtual keyboard</h2>
          <p className="text-xs text-muted-foreground">
            Lights up on physical press · click to simulate a hardware button
          </p>
        </div>
        {!deviceId ? (
          <span className="text-[10px] font-mono text-muted-foreground">No device</span>
        ) : teensyInteractive ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 uppercase tracking-wider">
            Dev · clicks drive device
          </span>
        ) : (
          <span className="rounded-full border border-border/60 bg-card/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Pi only · plug in Teensy to unlock
          </span>
        )}
      </div>

      <ButtonRow
        title="Notes (Teensy)"
        buttons={NOTE_BUTTONS}
        activePhysical={activePhysical}
        clickPressed={clickPressed}
        flashNote={flashNote}
        onDown={handleDown}
        onUp={handleUp}
        deviceId={deviceId}
        interactiveSource={teensyInteractive}
      />
      <ButtonRow
        title="Controls (Teensy, latching)"
        buttons={LATCHING_BUTTONS}
        activePhysical={activePhysical}
        clickPressed={clickPressed}
        flashNote={null}
        onDown={handleDown}
        onUp={handleUp}
        deviceId={deviceId}
        interactiveSource={teensyInteractive}
      />
      <ButtonRow
        title="Pi GPIO buttons"
        buttons={PI_BUTTONS}
        activePhysical={activePhysical}
        clickPressed={clickPressed}
        flashNote={null}
        onDown={handleDown}
        onUp={handleUp}
        deviceId={deviceId}
        // Pi rows are always observational — the Pi GPIO reader sends events
        // up through /api/sync/input-events, but we don't (yet) support
        // driving a GPIO input from the web. So interactivity is read-only.
        interactiveSource={false}
      />
    </div>
  );
}

function ButtonRow({
  title,
  buttons,
  activePhysical,
  clickPressed,
  flashNote,
  onDown,
  onUp,
  deviceId,
  interactiveSource,
}: {
  title: string;
  buttons: ButtonDef[];
  activePhysical: Set<string>;
  clickPressed: Set<string>;
  flashNote: string | null;
  onDown: (btn: ButtonDef) => void;
  onUp: (btn: ButtonDef) => void;
  deviceId: string | null;
  interactiveSource: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {buttons.map((btn) => {
          const isPhysical = activePhysical.has(btn.id);
          const isClicked = clickPressed.has(btn.id);
          const isFlash = flashNote === btn.id;
          const interactive = Boolean(btn.simKey && deviceId && interactiveSource);

          const baseClasses =
            "relative flex h-16 flex-col items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors select-none";
          const activeClasses =
            isPhysical
              ? "border-emerald-400 bg-emerald-500/15 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              : isClicked
              ? "border-amber-400 bg-amber-500/15 text-amber-100"
              : isFlash
              ? "border-violet-400 bg-violet-500/10 text-violet-100"
              : "border-border bg-card/50 text-foreground hover:border-muted-foreground/60";
          const interactiveCursor = interactive ? "cursor-pointer" : "cursor-default opacity-80";

          return (
            <button
              key={btn.id}
              type="button"
              disabled={!interactive}
              onPointerDown={(e) => {
                e.preventDefault();
                onDown(btn);
              }}
              onPointerUp={() => onUp(btn)}
              onPointerLeave={() => onUp(btn)}
              className={[baseClasses, activeClasses, interactiveCursor].join(" ")}
              title={`${btn.label}${btn.sublabel ? ` · ${btn.sublabel}` : ""}${
                btn.simKey ? ` · key "${btn.simKey}"` : ""
              }`}
            >
              <span className="text-sm font-semibold">{btn.label}</span>
              {btn.sublabel && (
                <span className="mt-0.5 text-[10px] font-mono text-muted-foreground/80">
                  {btn.sublabel}
                </span>
              )}
              {btn.simKey && (
                <span className="absolute right-1 top-1 font-mono text-[9px] text-muted-foreground">
                  {btn.simKey}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Exported so the parent can resolve the note id that corresponds to a given
 * `STATUS:NOTE:<name>` event (e.g. "A4" → closest row button). Keeps the
 * button table in one place.
 */
export function resolveNoteButtonId(noteName: string): string | null {
  const root = noteName.replace(/[0-9]+$/, "").toUpperCase();
  return NOTE_BUTTONS.find((b) => b.id === root)?.id ?? null;
}

/** Pin → button id map for BUTTON events from the Pi. */
export function resolveButtonIdByPin(
  pin: number,
  source: "teensy" | "pi"
): string | null {
  const pool = source === "pi" ? PI_BUTTONS : [...NOTE_BUTTONS, ...LATCHING_BUTTONS];
  return pool.find((b) => b.pin === pin)?.id ?? null;
}
