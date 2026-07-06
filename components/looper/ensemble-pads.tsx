"use client";

import { useCallback } from "react";
import { Sparkles, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EnsembleVoice } from "@/lib/ensemble/types";

// One octave, C4–C5. Black keys positioned over the white-key strip.
const WHITE_KEYS = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
const BLACK_KEYS: Array<{ note: string; leftPct: number }> = [
  { note: "C#4", leftPct: 9 },
  { note: "D#4", leftPct: 21.5 },
  { note: "F#4", leftPct: 46.5 },
  { note: "G#4", leftPct: 59 },
  { note: "A#4", leftPct: 71.5 },
];
// Computer-key → note for typed playing while the keyboard is focused.
const KEY_MAP: Record<string, string> = {
  a: "C4", w: "C#4", s: "D4", e: "D#4", d: "E4", f: "F4", t: "F#4",
  g: "G4", y: "G#4", h: "A4", u: "A#4", j: "B4", k: "C5",
};

interface EnsemblePadsProps {
  voices: EnsembleVoice[];
  activeIndex: number;
  ready: boolean;
  onSelectVoice: (index: number) => void;
  onPlayNote: (note: string) => void;
  onSwap: (index: number, alt: EnsembleVoice["alternatives"][number]) => void;
}

export function EnsemblePads({
  voices,
  activeIndex,
  ready,
  onSelectVoice,
  onPlayNote,
  onSwap,
}: EnsemblePadsProps) {
  const playable = voices.filter((v) => v.url);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.repeat) return;
      const note = KEY_MAP[e.key.toLowerCase()];
      if (note) {
        e.preventDefault();
        onPlayNote(note);
      }
    },
    [onPlayNote],
  );

  if (playable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No playable matches yet — generate an ensemble to load instruments.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Voice selector — pick which matched instrument the keyboard plays. */}
      <div className="flex flex-wrap gap-2">
        {voices.map((voice, i) => {
          if (!voice.url) return null;
          const active = i === activeIndex;
          return (
            <div key={i} className="flex items-center">
              <Button
                variant={active ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 rounded-r-none text-xs"
                onClick={() => {
                  onSelectVoice(i);
                  onPlayNote("C4");
                }}
                title={`${voice.instrument} → ${voice.sampleTitle ?? "sample"}`}
              >
                <span className="font-medium capitalize">{voice.role}</span>
                <span className="max-w-[10ch] truncate text-muted-foreground">
                  {voice.instrument}
                </span>
                {voice.isBestGuess && (
                  <Sparkles className="size-3 text-amber-400" aria-label="best-guess match" />
                )}
              </Button>
              {voice.alternatives.length > 0 ? (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant={active ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-7 rounded-l-none border-l-0"
                        title="Swap to another match"
                      >
                        <Shuffle className="size-3" />
                      </Button>
                    }
                  />
                  <PopoverContent align="start" className="w-56 p-1.5">
                    <div className="px-1.5 pb-1 text-[11px] font-medium text-muted-foreground">
                      Other matches
                    </div>
                    {voice.alternatives.map((alt) => (
                      <button
                        key={alt.sampleId}
                        className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                        onClick={() => onSwap(i, alt)}
                      >
                        {alt.title ?? alt.sampleId}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* One-octave keyboard — plays the active voice. Focus + type a–k too. */}
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative h-28 w-full max-w-md select-none rounded-lg border bg-card/60 outline-none focus:ring-2 focus:ring-amber-400/60",
          !ready && "pointer-events-none opacity-50",
        )}
        aria-label="Ensemble keyboard"
      >
        <div className="flex h-full w-full">
          {WHITE_KEYS.map((note) => (
            <button
              key={note}
              className="h-full flex-1 rounded-b-md border-r border-border/60 bg-background last:border-r-0 hover:bg-amber-100/20 active:bg-amber-200/30"
              onPointerDown={() => onPlayNote(note)}
              aria-label={note}
            />
          ))}
        </div>
        {BLACK_KEYS.map((key) => (
          <button
            key={key.note}
            className="absolute top-0 h-16 w-[7%] rounded-b-md bg-foreground/85 hover:bg-foreground active:bg-foreground/70"
            style={{ left: `${key.leftPct}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onPlayNote(key.note);
            }}
            aria-label={key.note}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Click keys or focus the keyboard and play <kbd className="rounded border bg-muted px-1">a</kbd>–<kbd className="rounded border bg-muted px-1">k</kbd>.
      </p>
    </div>
  );
}
