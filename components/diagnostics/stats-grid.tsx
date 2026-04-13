"use client";

import { useEffect, useRef, useState } from "react";
import type { MetricsResponse } from "@/app/api/metrics/route";

// Animate a number from 0 to target on mount
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setVal(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// SVG animated ring (stroke-dashoffset)
function RingChart({ percent, size = 64, stroke = 5 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = percent >= 90 ? "#22c55e" : percent >= 75 ? "#f59e0b" : "#ef4444";
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(circ * (1 - percent / 100));
    }, 200);
    return () => clearTimeout(t);
  }, [percent, circ]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={stroke} className="text-muted/40" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }}
      />
    </svg>
  );
}

// Mini sparkline SVG from an array of latency ms values
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-8 w-full rounded bg-muted/30" />;
  const max = Math.max(...values, 1);
  const w = 120;
  const h = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Mini bar histogram for uploads card
function MiniUploadBars({ byDay }: { byDay: MetricsResponse["uploads"]["byDay"] }) {
  const maxCount = Math.max(...byDay.map((d) => d.stems + d.master + d.uploads), 1);
  return (
    <div className="flex items-end gap-0.5 h-6 w-full mt-2">
      {byDay.map((day) => {
        const total = day.stems + day.master + day.uploads;
        const h = total === 0 ? 2 : Math.max(4, (total / maxCount) * 24);
        return (
          <div key={day.date} className="flex-1 flex flex-col items-stretch gap-px" style={{ height: `${h}px` }}>
            {day.stems > 0 && (
              <div style={{ flex: day.stems }} className="rounded-sm bg-emerald-500/70" />
            )}
            {day.master > 0 && (
              <div style={{ flex: day.master }} className="rounded-sm bg-violet-500/70" />
            )}
            {day.uploads > 0 && (
              <div style={{ flex: day.uploads }} className="rounded-sm bg-amber-500/70" />
            )}
            {total === 0 && (
              <div className="w-full bg-muted/30 rounded-sm" style={{ height: "2px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  commands: MetricsResponse["commands"];
  uploads: MetricsResponse["uploads"];
  sessions: MetricsResponse["sessions"];
  latencyHistory: number[]; // raw ms values for sparkline
}

export function StatsGrid({ commands, uploads, sessions, latencyHistory }: Props) {
  const responsiveness = useCountUp(commands.responsiveness);
  const uploadsToday = useCountUp(uploads.total24h);
  const sessionsToday = sessions.total7d; // use 7d total for context

  const latencyColor = commands.avgLatencyMs < 3000 ? "#22c55e"
    : commands.avgLatencyMs < 6000 ? "#f59e0b" : "#ef4444";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Responsiveness */}
      <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
        <RingChart percent={commands.responsiveness} />
        <div>
          <p className="text-2xl font-bold tabular-nums">{responsiveness}%</p>
          <p className="text-xs text-muted-foreground">Responsiveness</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">cmds &lt;5s / 24h</p>
        </div>
      </div>

      {/* Avg command latency */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-2xl font-bold tabular-nums">
            {commands.avgLatencyMs > 0
              ? `${(commands.avgLatencyMs / 1000).toFixed(1)}s`
              : "—"}
          </p>
          <span className="text-[10px] text-muted-foreground">avg latency</span>
        </div>
        <Sparkline values={latencyHistory} color={latencyColor} />
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          p95 {commands.p95LatencyMs > 0 ? `${(commands.p95LatencyMs / 1000).toFixed(1)}s` : "—"}
          &nbsp;·&nbsp;{commands.total24h} commands
        </p>
      </div>

      {/* Uploads */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold tabular-nums">{uploadsToday}</p>
          <span className="text-[10px] text-muted-foreground">today</span>
        </div>
        <p className="text-xs text-muted-foreground mb-1">Recordings</p>
        <MiniUploadBars byDay={uploads.byDay} />
        <div className="flex items-center gap-2 mt-1.5">
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <span className="size-1.5 rounded-sm bg-emerald-500/70 inline-block" /> stems
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <span className="size-1.5 rounded-sm bg-violet-500/70 inline-block" /> mix
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <span className="size-1.5 rounded-sm bg-amber-500/70 inline-block" /> upload
          </span>
        </div>
      </div>

      {/* Sessions */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold tabular-nums">{sessions.total7d}</p>
          <span className="text-[10px] text-muted-foreground">this week</span>
        </div>
        <p className="text-xs text-muted-foreground">Sessions</p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground/60">Looper</span>
            <span className="text-emerald-500 font-medium">{sessions.loopSessions7d}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground/60">Total time</span>
            <span className="text-muted-foreground">{sessions.totalMinutes7d}m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
