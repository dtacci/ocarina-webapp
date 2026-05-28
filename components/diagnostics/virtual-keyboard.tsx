"use client";

import { useCallback, useRef, useState } from "react";
import {
  type ButtonDef,
  NOTE_BUTTONS,
  LATCHING_BUTTONS,
  PI_BUTTONS,
} from "@/lib/hardware/button-layout";

export { resolveNoteButtonId, resolveButtonIdByPin } from "@/lib/hardware/button-layout";

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

