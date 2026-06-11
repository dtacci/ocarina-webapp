"use client";

/**
 * 4 rekordbox-colored performance pads per deck.
 *   click empty pad  → store hot cue at the playhead
 *   click set pad    → jump to it (play state preserved)
 *   shift-click      → clear
 *
 * Pad lit-state is mirrored from deck.getState() on a slow interval (4 Hz)
 * rather than per-click state only, so cues set by hardware buttons light up
 * too.
 */
import { useEffect, useState } from "react";
import type { DjDeck } from "@/lib/audio/dj-engine";

const PAD_VARS = ["--dj-pad-1", "--dj-pad-2", "--dj-pad-3", "--dj-pad-4"];

export interface HotCuePadsProps {
  deck: DjDeck;
  deckLabel: "A" | "B";
  disabled?: boolean;
}

export function HotCuePads({ deck, deckLabel, disabled = false }: HotCuePadsProps) {
  const [cues, setCues] = useState<(number | null)[]>([null, null, null, null]);

  useEffect(() => {
    const iv = setInterval(() => {
      const next = deck.getState().hotCues;
      setCues((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next,
      );
    }, 250);
    return () => clearInterval(iv);
  }, [deck]);

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cues.map((sec, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          data-set={sec !== null}
          aria-label={`hot cue ${i + 1} deck ${deckLabel}`}
          title={
            sec === null
              ? "click: set hot cue at playhead"
              : "click: jump · shift-click: clear"
          }
          className="dj-pad"
          style={{ "--pad-accent": `var(${PAD_VARS[i]})` } as React.CSSProperties}
          onClick={(e) => {
            if (e.shiftKey) {
              deck.clearHotCue(i);
            } else if (sec === null) {
              deck.setHotCue(i);
            } else {
              deck.jumpHotCue(i);
            }
            setCues(deck.getState().hotCues);
          }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
