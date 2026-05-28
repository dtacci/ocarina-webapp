"use client";

import { useEffect } from "react";

/**
 * Number key → button index (1..12) using the digit row.
 *   1 2 3 4 5 6 7 8 9 0 - =   →  1..12
 */
const NUM_KEY_TO_BUTTON: Record<string, number> = {
  "1": 1, "2": 2, "3": 3, "4": 4,
  "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "0": 10, "-": 11, "=": 12,
};

const NOTE_KEYS = new Set(["c", "d", "e", "f", "g", "a", "b"]);
const SHARPABLE = new Set(["c", "d", "f", "g", "a"]); // no E# / B#

interface Props {
  /** Currently-focused button (1..12), null when nothing focused. */
  focused: number | null;
  setFocused: (n: number | null) => void;
  /** Live mapping snapshot, used to ignore no-op assigns. */
  buttonCount: number;
  /** Sends a note (or "default") to the focused button. */
  onAssign: (button: number, value: string) => void;
  /** Open the cheat-sheet popover. */
  onHelp: () => void;
}

/**
 * Headless keyboard layer for the configurator. Renders nothing — just
 * attaches/detaches a window-level keydown listener. Skips when the user is
 * typing into a text input or when a popover/dialog has focus.
 */
export function ConfiguratorHotkeys({
  focused,
  setFocused,
  buttonCount,
  onAssign,
  onHelp,
}: Props) {
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

      // Esc → clear focus
      if (e.key === "Escape") {
        if (focused !== null) {
          e.preventDefault();
          setFocused(null);
        }
        return;
      }

      // Number row → focus button
      const targetBtn = NUM_KEY_TO_BUTTON[e.key];
      if (typeof targetBtn === "number" && targetBtn <= buttonCount) {
        e.preventDefault();
        setFocused(focused === targetBtn ? null : targetBtn);
        return;
      }

      // Note assignment requires a focused button
      if (focused === null) return;

      const key = e.key.toLowerCase();

      if (NOTE_KEYS.has(key)) {
        e.preventDefault();
        const sharp = e.shiftKey && SHARPABLE.has(key);
        const note = key.toUpperCase() + (sharp ? "#" : "");
        onAssign(focused, note);
        return;
      }

      // Reset to default
      if (key === "r" || e.key === "Backspace") {
        e.preventDefault();
        onAssign(focused, "default");
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focused, setFocused, buttonCount, onAssign, onHelp]);

  return null;
}
