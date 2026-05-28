"use client";

import type { HeartbeatEvent } from "@/lib/ocarina-api";

interface Props {
  pots: HeartbeatEvent["pots"] | null;
}

const POTS: { key: keyof HeartbeatEvent["pots"]; label: string; color: string }[] = [
  { key: "volume",     label: "Volume",     color: "bg-emerald-500" },
  { key: "reverb_mix", label: "Reverb Mix", color: "bg-sky-500" },
  { key: "filter",     label: "Filter",     color: "bg-amber-500" },
  { key: "pitch_bend", label: "Pitch Bend", color: "bg-violet-500" },
];

/**
 * Live readout of the four hardware pots, sampled from each Pi heartbeat.
 * Values are 0..100 (integer). Display as a horizontal bar + numeric.
 */
export function PotsPanel({ pots }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Pots</h2>
        <span className="font-mono text-[10px] text-muted-foreground">
          {pots ? "live · 1 Hz" : "waiting…"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {POTS.map((p) => {
          const value = pots?.[p.key] ?? null;
          const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
          return (
            <div key={p.key} className="space-y-1">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-mono tabular-nums text-foreground/80">
                  {value === null ? "—" : value}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-background/60">
                <div
                  className={`absolute inset-y-0 left-0 ${p.color} transition-[width] duration-300`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
