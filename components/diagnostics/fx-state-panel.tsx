"use client";

import { useEffect, useRef, useState } from "react";

export interface FxState {
  mode: string | null;                    // OFF / DRY / HARMONY / DISTORT / HARM+DIST
  harmony: string | null;                 // +3rd / +5th / +oct / -3rd / -5th / -oct
  distort: string | null;                 // soft-clip / hard-clip / fuzz
  reverb: boolean | null;                 // on/off
  reverb_level: string | null;            // low / med / high
  waveform: string | null;                // sine / triangle / sawtooth / square
  synth_harmony: boolean | null;          // synth-voice harmony on/off
  synth_harmony_interval: string | null;  // 3rd / 5th / octave
  octave: number | null;                  // -3 … +3
}

export const EMPTY_FX_STATE: FxState = {
  mode: null,
  harmony: null,
  distort: null,
  reverb: null,
  reverb_level: null,
  waveform: null,
  synth_harmony: null,
  synth_harmony_interval: null,
  octave: null,
};

interface Props {
  state: FxState;
}

export function FxStatePanel({ state }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Synth &amp; FX state</h2>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          V7.2 · from serial
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <FxCard label="Voice FX mode" value={state.mode} hint="v · cycle" />
        <FxCard label="Harmony interval" value={state.harmony} hint="V · cycle" />
        <FxCard label="Distortion" value={state.distort} hint="c · cycle" />
        <FxCard
          label="Reverb"
          value={
            state.reverb === null
              ? null
              : state.reverb
              ? state.reverb_level
                ? `on · ${state.reverb_level}`
                : "on"
              : "off"
          }
          hint="g · G cycles level"
        />
        <FxCard label="Waveform" value={state.waveform} hint="h · cycle" />
        <FxCard
          label="Synth harmony"
          value={
            state.synth_harmony === null
              ? null
              : state.synth_harmony
              ? state.synth_harmony_interval ?? "on"
              : "off"
          }
          hint="o · O cycles interval"
        />
        <FxCard
          label="Octave shift"
          value={state.octave === null ? null : formatSigned(state.octave)}
          hint="j / k · ±1"
        />
      </div>
    </div>
  );
}

function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

function FxCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint?: string;
}) {
  const [flash, setFlash] = useState(false);
  const lastValueRef = useRef<string | null>(value);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      if (value !== null) {
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 700);
        return () => clearTimeout(t);
      }
    }
  }, [value]);

  return (
    <div
      className={[
        "rounded-lg border px-3 py-2 transition-colors",
        flash
          ? "border-amber-400 bg-amber-500/10"
          : "border-border bg-background/40",
      ].join(" ")}
      style={{ transition: "background-color 0.7s ease-out, border-color 0.7s ease-out" }}
    >
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-sm text-foreground">
        {value ?? "—"}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-muted-foreground/70">{hint}</div>
      )}
    </div>
  );
}
