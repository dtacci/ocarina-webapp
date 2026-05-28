"use client";

import { useEffect } from "react";

/**
 * Headless keyboard layer for the looper dashboard. Sends the firmware
 * sim-key char on each shortcut; the dashboard panel reacts via the same
 * loop_state event stream the transport buttons trigger.
 *
 *   1 2 3 4   → select track 1..4
 *   R / Space → record / all-off
 *   M         → mute active track
 *   T         → tap tempo
 *   ?         → help popover
 */
interface Props {
  onSim: (key: string) => void;
  onHelp: () => void;
}

export function LooperHotkeys({ onSim, onHelp }: Props) {
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        !!target.closest("[data-slot='popover-content'], [role='dialog']")
      );
    }

    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // Help
      if (e.key === "?") {
        e.preventDefault();
        onHelp();
        return;
      }

      // 1-4 → track select (matches firmware sim-key)
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        onSim(e.key);
        return;
      }

      const key = e.key.toLowerCase();
      // R or Space → both record & all-off use separate firmware chars.
      // Map "r" → 'l' (record), space → ' ' (all-off), "m" → 'a' (mute),
      // "t" → 'b' (tap tempo). These keep the on-screen mnemonics natural.
      if (key === "r") { e.preventDefault(); onSim("l"); return; }
      if (e.key === " ") { e.preventDefault(); onSim(" "); return; }
      if (key === "m") { e.preventDefault(); onSim("a"); return; }
      if (key === "t") { e.preventDefault(); onSim("b"); return; }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSim, onHelp]);

  return null;
}
