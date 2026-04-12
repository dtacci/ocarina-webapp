"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Play, Pause } from "lucide-react";
import type { SampleWithVibes } from "@/lib/db/queries/samples";
import { Badge } from "@/components/ui/badge";

const familyColors: Record<string, string> = {
  strings: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  brass: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  woodwind: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  keys: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  mallet: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  drums: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  guitar: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  other_perc: "bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  fx: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
};

function AttributeBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="w-8 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground/30"
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="w-3 text-right text-muted-foreground">{value}</span>
    </div>
  );
}

export function SampleCard({ sample }: { sample: SampleWithVibes }) {
  const familyClass = familyColors[sample.family || ""] || familyColors.other;
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasPreview = !!sample.mp3_blob_url;

  function handlePlay(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!hasPreview) return;

    // Lazy-create the audio element on first click
    if (!audioRef.current) {
      const a = new Audio(sample.mp3_blob_url!);
      a.addEventListener("ended", () => setIsPlaying(false));
      a.addEventListener("pause", () => setIsPlaying(false));
      a.addEventListener("play", () => setIsPlaying(true));
      audioRef.current = a;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {/* browser autoplay policy */});
    }
  }

  return (
    <Link
      href={`/library/${encodeURIComponent(sample.id)}`}
      className="group block rounded-xl border border-border/50 bg-card/80 p-3 transition-all hover:border-primary/30 hover:bg-card hover-lift"
    >
      {/* Waveform / play area */}
      <div className="mb-2 h-12 rounded bg-muted/50 relative flex items-center justify-center overflow-hidden">
        {/* Decorative waveform bars */}
        <div className="flex items-end gap-px h-8 w-full px-1">
          {Array.from({ length: 32 }, (_, i) => {
            const h = sample.waveform_peaks
              ? Math.max(2, (sample.waveform_peaks[i * 6] || 0) * 32)
              : Math.max(2, Math.sin(i * 0.3 + sample.id.length) * 12 + 14);
            return (
              <div
                key={i}
                className="flex-1 rounded-sm bg-foreground/20 group-hover:bg-foreground/30 transition-colors"
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>

        {/* Play button — only shown when preview is available */}
        {hasPreview && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/40 backdrop-blur-[1px]"
            title={isPlaying ? "Pause preview" : "Play 6s preview"}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors">
              {isPlaying
                ? <Pause className="size-3.5" />
                : <Play className="size-3.5 ml-px" />}
            </span>
          </button>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-medium truncate flex-1" title={sample.id}>
          {sample.id}
        </h3>
        <span className="text-xs text-muted-foreground shrink-0">
          {sample.duration_sec.toFixed(1)}s
        </span>
      </div>

      {/* Family + root note */}
      <div className="flex items-center gap-1.5 mb-2">
        {sample.family && (
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${familyClass}`}>
            {sample.family}
          </Badge>
        )}
        {sample.root_note && (
          <span className="text-xs text-muted-foreground">{sample.root_note}</span>
        )}
      </div>

      {/* Attributes */}
      <div className="space-y-1 mb-2">
        <AttributeBar label="BRT" value={sample.brightness} />
        <AttributeBar label="WRM" value={sample.warmth} />
        <AttributeBar label="ATK" value={sample.attack} />
        <AttributeBar label="SUS" value={sample.sustain} />
      </div>

      {/* Vibes */}
      {sample.vibes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sample.vibes.slice(0, 4).map((v) => (
            <Badge key={v} variant="outline" className="text-[10px] px-1 py-0">
              {v}
            </Badge>
          ))}
          {sample.vibes.length > 4 && (
            <span className="text-[10px] text-muted-foreground">
              +{sample.vibes.length - 4}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
