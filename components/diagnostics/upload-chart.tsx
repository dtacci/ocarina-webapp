"use client";

import { useEffect, useState } from "react";
import type { MetricsResponse } from "@/app/api/metrics/route";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TooltipData {
  day: MetricsResponse["uploads"]["byDay"][number];
  x: number;
  y: number;
}

interface Props {
  byDay: MetricsResponse["uploads"]["byDay"];
}

export function UploadChart({ byDay }: Props) {
  const [mounted, setMounted] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  // Trigger stagger animation after mount
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const maxTotal = Math.max(
    ...byDay.map((d) => d.stems + d.master + d.uploads),
    1
  );
  const chartH = 120;
  const barW = 36;
  const gap = 8;
  const totalW = byDay.length * (barW + gap) - gap;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Upload activity</h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="size-2 rounded-sm bg-emerald-500/70 inline-block" /> Stems
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="size-2 rounded-sm bg-violet-500/70 inline-block" /> Mix
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="size-2 rounded-sm bg-amber-500/70 inline-block" /> Upload
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${totalW} ${chartH + 20}`}
          className="w-full overflow-visible"
          onMouseLeave={() => setTooltip(null)}
        >
          {byDay.map((day, i) => {
            const x = i * (barW + gap);
            const total = day.stems + day.master + day.uploads;
            const totalH = total === 0 ? 2 : (total / maxTotal) * chartH;
            const isToday = day.date === today;

            // Stacked bar heights
            const stemsH  = total === 0 ? 0 : (day.stems  / total) * totalH;
            const masterH = total === 0 ? 0 : (day.master / total) * totalH;
            const uploadsH = total === 0 ? 0 : (day.uploads / total) * totalH;

            // Stagger delay: today = 0ms, yesterday = 60ms, ...
            const delay = (6 - i) * 60;
            const scaleY = mounted ? 1 : 0;

            return (
              <g key={day.date}>
                {/* Today highlight */}
                {isToday && (
                  <rect x={x - 2} y={0} width={barW + 4} height={chartH}
                    className="fill-primary/5 rounded" rx={4} />
                )}

                {/* Zero-day dot */}
                {total === 0 && (
                  <circle cx={x + barW / 2} cy={chartH - 1} r={2}
                    className="fill-muted-foreground/20" />
                )}

                {/* Stacked bars (grow from bottom) */}
                <g
                  transform={`translate(${x}, ${chartH})`}
                  style={{
                    transform: `translate(${x}px, ${chartH}px) scaleY(${scaleY})`,
                    transformOrigin: `${x + barW / 2}px ${chartH}px`,
                    transition: `transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
                  }}
                >
                  {/* Uploads (bottom) */}
                  {uploadsH > 0 && (
                    <rect x={0} y={-(stemsH + masterH + uploadsH)} width={barW}
                      height={uploadsH} rx={2} className="fill-amber-500/70" />
                  )}
                  {/* Master */}
                  {masterH > 0 && (
                    <rect x={0} y={-(stemsH + masterH)} width={barW}
                      height={masterH} rx={2} className="fill-violet-500/70" />
                  )}
                  {/* Stems (top) */}
                  {stemsH > 0 && (
                    <rect x={0} y={-stemsH} width={barW}
                      height={stemsH} rx={2} className="fill-emerald-500/70" />
                  )}
                </g>

                {/* Invisible hit zone for tooltip */}
                <rect
                  x={x} y={0} width={barW} height={chartH}
                  fill="transparent"
                  className="cursor-default"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ day, x: x + barW / 2, y: 0 });
                  }}
                />

                {/* Day label */}
                <text
                  x={x + barW / 2}
                  y={chartH + 14}
                  textAnchor="middle"
                  fontSize={10}
                  className={`fill-muted-foreground ${isToday ? "font-semibold" : ""}`}
                >
                  {DAY_LABELS[new Date(day.date + "T12:00:00").getDay()]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (() => {
          const d = tooltip.day;
          const total = d.stems + d.master + d.uploads;
          const pct = (barW + gap) / totalW * 100;
          const idx = byDay.indexOf(d);
          return (
            <div
              className="absolute pointer-events-none z-10 rounded-lg border bg-card/95 backdrop-blur-sm px-3 py-2 text-xs shadow-lg -translate-x-1/2"
              style={{ left: `${(idx * (barW + gap) + barW / 2) / totalW * 100}%`, top: "0%" }}
            >
              <p className="font-medium mb-1">
                {new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
              {total === 0 ? (
                <p className="text-muted-foreground">No uploads</p>
              ) : (
                <div className="space-y-0.5">
                  {d.stems > 0 && <p className="text-emerald-400">{d.stems} stem{d.stems !== 1 ? "s" : ""}</p>}
                  {d.master > 0 && <p className="text-violet-400">{d.master} mix</p>}
                  {d.uploads > 0 && <p className="text-amber-400">{d.uploads} upload{d.uploads !== 1 ? "s" : ""}</p>}
                  <p className="text-muted-foreground border-t pt-0.5 mt-0.5">{total} total</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
