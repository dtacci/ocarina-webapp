"use client";

import { useEffect, useRef } from "react";

export interface DrumKeyboardHandlers {
  togglePlay: () => void;
  toggleStepAtCursor: (voiceIdx: number) => void;
  moveCursor: (dStep: number, dVoice: number) => void;
  switchPattern: (index: number) => void;
  cyclePattern: (direction: 1 | -1) => void;
  clearPattern: () => void;
  tapTempo: () => void;
  cycleVelocityAtCursor: () => void;
  toggleHelp: () => void;
}

/**
 * Keyboard bindings for the drum sequencer.
 *
 * Bindings (active only when `enabled` is true — typically when the drum
 * surface has focus, to avoid collision with the Looper page's own shortcuts
 * like Space/1-6/arrows):
 *
 * - Space             play/pause
 * - Q W E R T Y U I   toggle step at cursor on voice 1-8
 * - ArrowL / ArrowR   move step cursor
 * - ArrowU / ArrowD   move voice cursor
 * - [ / ]             previous / next pattern
 * - Z X C V           jump to pattern A/B/C/D
 * - `                 tap-tempo
 * - Shift + C         clear current pattern
 * - F                 cycle velocity at cursor (off → low → mid → high)
 * - ?                 toggle cheat-sheet
 * - Escape            blur drum surface (handled by caller)
 */
export function useDrumKeyboard(
  enabled: boolean,
  handlers: DrumKeyboardHandlers
): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const voiceKeys = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI"];
    const patternKeys = ["KeyZ", "KeyX", "KeyC", "KeyV"];

    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      const h = handlersRef.current;

      // Voice step toggles (Q W E R T Y U I).
      const voiceIdx = voiceKeys.indexOf(e.code);
      if (voiceIdx !== -1) {
        e.preventDefault();
        h.toggleStepAtCursor(voiceIdx);
        return;
      }

      // Pattern jumps (Z X C V).
      const patternIdx = patternKeys.indexOf(e.code);
      if (patternIdx !== -1) {
        e.preventDefault();
        h.switchPattern(patternIdx);
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          h.togglePlay();
          return;
        case "ArrowLeft":
          e.preventDefault();
          h.moveCursor(-1, 0);
          return;
        case "ArrowRight":
          e.preventDefault();
          h.moveCursor(1, 0);
          return;
        case "ArrowUp":
          e.preventDefault();
          h.moveCursor(0, -1);
          return;
        case "ArrowDown":
          e.preventDefault();
          h.moveCursor(0, 1);
          return;
        case "BracketLeft":
          e.preventDefault();
          h.cyclePattern(-1);
          return;
        case "BracketRight":
          e.preventDefault();
          h.cyclePattern(1);
          return;
        case "Backquote":
          e.preventDefault();
          h.tapTempo();
          return;
        case "KeyF":
          e.preventDefault();
          h.cycleVelocityAtCursor();
          return;
        case "Slash":
          // `/` with Shift is `?` on US keyboards.
          if (e.shiftKey) {
            e.preventDefault();
            h.toggleHelp();
          }
          return;
      }

      // Shift+C = clear pattern (KeyC without Shift is pattern jump).
      if (e.code === "KeyC" && e.shiftKey) {
        e.preventDefault();
        h.clearPattern();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
