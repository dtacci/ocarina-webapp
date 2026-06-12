"use client";

/**
 * "Save loop" — offline-renders the active drum pattern at the current
 * kit/bpm into an exactly-bar-aligned WAV and saves it as a bpm-tagged loop
 * master (recordings row). The result shows up in the DJ deck browser's
 * loops tab, the recordings page, and the track mixer — pipeline brick #1.
 */
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Pattern } from "@/lib/audio/drum-engine";
import type { KitManifest } from "@/lib/audio/drum-kit-manifest";
import { renderPatternLoop } from "@/lib/audio/drum-render";
import { encodeWav } from "@/lib/audio/wav-encoder";
import { computePeaksFromBuffer } from "@/lib/audio/compute-peaks";

export interface SaveLoopButtonProps {
  pattern: Pattern;
  mutes: boolean[];
  kit: KitManifest;
  bpm: number;
}

type Phase = "idle" | "rendering" | "saved" | "error";

export function SaveLoopButton({ pattern, mutes, kit, bpm }: SaveLoopButtonProps) {
  const [open, setOpen] = useState(false);
  const [bars, setBars] = useState(2);
  const [phase, setPhase] = useState<Phase>("idle");

  const hasSteps = pattern.some((row) => row.some((s) => s.on));

  const save = async () => {
    setPhase("rendering");
    try {
      const buffer = await renderPatternLoop({ pattern, mutes, kit, bpm, bars });
      const wav = encodeWav(buffer);
      const form = new FormData();
      form.append("wav", new Blob([wav], { type: "audio/wav" }));
      form.append("name", `Drum loop — ${kit.name} — ${bpm} bpm`);
      form.append("durationSec", String(buffer.duration));
      form.append("sampleRate", String(buffer.sampleRate));
      form.append("bpm", String(bpm));
      form.append("waveformPeaks", JSON.stringify(computePeaksFromBuffer(buffer)));
      const res = await fetch("/api/dj/recordings", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setPhase("saved");
      setTimeout(() => {
        setPhase("idle");
        setOpen(false);
      }, 1200);
    } catch (err) {
      console.error("[SaveLoopButton]", err);
      setPhase("error");
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); setPhase("idle"); }}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!hasSteps}
            title={hasSteps ? "render this pattern to a loop in your library" : "pattern is empty"}
            aria-label="save loop"
          >
            <Save className="size-3.5" />
            <span className="text-xs">Save loop</span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-56 space-y-3 p-3">
        <p className="text-xs text-muted-foreground">
          Renders the pattern at {bpm} bpm with {kit.name} into a seamless loop
          — lands in recordings + the DJ loops tab.
        </p>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="loop length in bars">
          {[1, 2, 4].map((b) => (
            <Button
              key={b}
              variant={bars === b ? "default" : "outline"}
              size="sm"
              role="radio"
              aria-checked={bars === b}
              className="flex-1 text-xs"
              onClick={() => setBars(b)}
            >
              {b} bar{b > 1 ? "s" : ""}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          className="w-full gap-2"
          disabled={phase === "rendering"}
          onClick={() => void save()}
          aria-label="render and save loop"
        >
          {phase === "rendering" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> rendering…
            </>
          ) : phase === "saved" ? (
            "saved ✓"
          ) : phase === "error" ? (
            "failed — retry"
          ) : (
            "render & save"
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
