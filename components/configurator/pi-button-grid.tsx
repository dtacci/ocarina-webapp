"use client";

import { useEffect, useRef, useState } from "react";

import type { ButtonState } from "@/lib/ocarina-api";
import { NotePickerPopover } from "@/components/configurator/note-picker-popover";

interface Props {
  buttons: ButtonState[];
  /** Set of button numbers (1..12) currently being pressed on the device. */
  pressed: Set<number>;
  /** Currently keyboard-focused button (1..12), null when none. */
  focused?: number | null;
  onAssign: (button: number, value: string) => Promise<void>;
  /** Tile click also sets keyboard focus, so a follow-up letter key assigns. */
  onFocus?: (button: number | null) => void;
}

const FLASH_MS = 350;

export function PiButtonGrid({
  buttons,
  pressed,
  focused = null,
  onAssign,
  onFocus,
}: Props) {
  // Hold a short post-release flash so quick presses register visually.
  const [flashing, setFlashing] = useState<Set<number>>(new Set());
  const flashTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // When a button transitions out of `pressed`, kick a flash timer.
  const prevPressedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const prev = prevPressedRef.current;
    for (const n of prev) {
      if (!pressed.has(n)) {
        setFlashing((f) => new Set(f).add(n));
        const existing = flashTimersRef.current.get(n);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setFlashing((f) => {
            const next = new Set(f);
            next.delete(n);
            return next;
          });
          flashTimersRef.current.delete(n);
        }, FLASH_MS);
        flashTimersRef.current.set(n, t);
      }
    }
    prevPressedRef.current = new Set(pressed);
  }, [pressed]);

  useEffect(
    () => () => {
      flashTimersRef.current.forEach((t) => clearTimeout(t));
      flashTimersRef.current.clear();
    },
    []
  );

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {buttons.map((b) => {
        const isPressed = pressed.has(b.button);
        const isFlash = flashing.has(b.button);
        const isFocused = focused === b.button;
        const tone = isPressed
          ? "border-emerald-400 bg-emerald-500/15 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.25)]"
          : isFlash
            ? "border-violet-400 bg-violet-500/10 text-violet-100"
            : b.overridden
              ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
              : "border-border bg-card text-foreground hover:border-foreground/40";
        const focusRing = isFocused
          ? "ring-2 ring-sky-400/70 ring-offset-1 ring-offset-background"
          : "";

        return (
          <NotePickerPopover
            key={b.button}
            current={b.note_name ?? b.default_name}
            defaultName={b.default_name}
            onAssign={(v) => onAssign(b.button, v)}
          >
            <button
              type="button"
              onClick={() => onFocus?.(b.button)}
              className={[
                "relative flex h-20 flex-col items-stretch justify-between rounded-lg border px-2 py-1.5 text-left transition-colors",
                tone,
                focusRing,
              ].join(" ")}
              title={`Button ${b.button} · default ${b.default_name}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  #{b.button}
                </span>
                {b.overridden && (
                  <span
                    className="size-1.5 rounded-full bg-amber-400"
                    title="overridden"
                  />
                )}
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold leading-none">
                  {b.note_name ?? b.default_name}
                </div>
                {b.overridden && (
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-amber-300/80">
                    default {b.default_name}
                  </div>
                )}
              </div>
            </button>
          </NotePickerPopover>
        );
      })}
    </div>
  );
}
