"use client";

/**
 * Interpretation controls (doc §6.1): tempo (+ tap-tempo), time signature, key
 * (with detected candidates), and quantize grid. Standard accessible form
 * controls (doc §6.6). Changes bubble up; the parent debounces + re-derives.
 */

import { useRef } from "react";
import { Music, Hand } from "lucide-react";
import type {
  DeriveParams,
  KeyCandidate,
  QuantizeGrid,
  TimeSignature,
} from "@/lib/transcription/types";

const TIME_SIGNATURES: { label: string; value: TimeSignature }[] = [
  { label: "4/4", value: [4, 4] },
  { label: "3/4", value: [3, 4] },
  { label: "2/4", value: [2, 4] },
  { label: "6/8", value: [6, 8] },
  { label: "3/8", value: [3, 8] },
  { label: "12/8", value: [12, 8] },
];

const GRIDS: { label: string; value: QuantizeGrid }[] = [
  { label: "1/4", value: "1/4" },
  { label: "1/8", value: "1/8" },
  { label: "1/16", value: "1/16" },
  { label: "1/8T", value: "1/8t" },
  { label: "1/16T", value: "1/16t" },
];

const KEYS = (() => {
  const tonics = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
  const out: string[] = [];
  for (const t of tonics) out.push(`${t} major`);
  for (const t of ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"])
    out.push(`${t} minor`);
  return out;
})();

export interface InterpretationControlsProps {
  params: DeriveParams;
  keyCandidates: KeyCandidate[];
  busy: boolean;
  onChange: (patch: Partial<DeriveParams>) => void;
}

export function InterpretationControls({
  params,
  keyCandidates,
  busy,
  onChange,
}: InterpretationControlsProps) {
  const tapsRef = useRef<number[]>([]);

  function handleTap() {
    const now = performance.now();
    const taps = tapsRef.current;
    // Reset if the last tap was long ago (new measurement).
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      if (bpm >= 30 && bpm <= 300) onChange({ tempo_bpm: bpm });
    }
  }

  const labelCls = "text-xs font-medium text-muted-foreground";
  const fieldCls =
    "rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <aside
      className={`space-y-5 rounded-lg border bg-card p-4 transition-opacity ${busy ? "opacity-60" : ""}`}
      aria-busy={busy}
    >
      <div className="flex items-center gap-2 text-primary">
        <Music className="size-4" />
        <h2 className="text-sm font-semibold">Interpretation</h2>
      </div>

      {/* Tempo */}
      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="tempo">Tempo (BPM)</label>
        <div className="flex items-center gap-2">
          <input
            id="tempo"
            type="number"
            min={30}
            max={300}
            value={params.tempo_bpm}
            onChange={(e) => onChange({ tempo_bpm: Number(e.target.value) })}
            className={`${fieldCls} w-24 tabular-nums`}
          />
          <button
            type="button"
            onClick={handleTap}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
            title="Tap repeatedly to set the tempo"
          >
            <Hand className="size-3.5" /> Tap
          </button>
        </div>
      </div>

      {/* Time signature */}
      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="timesig">Time signature</label>
        <select
          id="timesig"
          value={`${params.time_signature[0]}/${params.time_signature[1]}`}
          onChange={(e) => {
            const found = TIME_SIGNATURES.find((t) => t.label === e.target.value);
            if (found) onChange({ time_signature: found.value });
          }}
          className={`${fieldCls} w-full`}
        >
          {TIME_SIGNATURES.map((t) => (
            <option key={t.label} value={t.label}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Key */}
      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="key">Key signature</label>
        <select
          id="key"
          value={params.key_signature}
          onChange={(e) => onChange({ key_signature: e.target.value })}
          className={`${fieldCls} w-full`}
        >
          <option value="auto">Auto-detect</option>
          {KEYS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        {params.key_signature === "auto" && keyCandidates.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {keyCandidates.slice(0, 3).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onChange({ key_signature: c.key })}
                className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                title={`Confidence ${(c.score * 100).toFixed(0)}%`}
              >
                {c.key}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Transpose */}
      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="transpose">Transpose</label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange({ transpose: Math.max(-24, (params.transpose ?? 0) - 12) })}
            className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
            title="Down an octave"
          >
            −8va
          </button>
          <button
            type="button"
            onClick={() => onChange({ transpose: Math.max(-24, (params.transpose ?? 0) - 1) })}
            className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
            aria-label="Down a semitone"
          >
            −
          </button>
          <span id="transpose" className="min-w-12 text-center text-sm tabular-nums">
            {(params.transpose ?? 0) > 0 ? `+${params.transpose}` : params.transpose ?? 0} st
          </span>
          <button
            type="button"
            onClick={() => onChange({ transpose: Math.min(24, (params.transpose ?? 0) + 1) })}
            className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
            aria-label="Up a semitone"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onChange({ transpose: Math.min(24, (params.transpose ?? 0) + 12) })}
            className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
            title="Up an octave"
          >
            +8va
          </button>
        </div>
      </div>

      {/* Quantize grid */}
      <div className="space-y-1.5">
        <span className={labelCls}>Quantize grid</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quantize grid">
          {GRIDS.map((g) => {
            const active = params.quantize_grid === g.value;
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => onChange({ quantize_grid: g.value })}
                aria-pressed={active}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
