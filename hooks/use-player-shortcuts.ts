"use client";

import { useEffect } from "react";
import { useAudioPlayerStore } from "@/lib/stores/audio-player";

/**
 * Global keyboard shortcuts for the audio player. No-op when focus is
 * inside an input/textarea/select or contenteditable region, or when
 * modifier keys (Cmd/Ctrl/Alt) are held. Shift is permitted (for future
 * shift-combos).
 *
 * Bindings:
 *   Space    toggle play/pause
 *   ← / →    seek ±5s
 *   ↑ / ↓    volume ±5%
 *   M        toggle mute
 *   N        next in queue
 *   P        previous in queue
 */
export function usePlayerShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const store = useAudioPlayerStore.getState();
      if (!store.current) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          store.toggle();
          return;
        case "ArrowLeft":
          e.preventDefault();
          store.seek(Math.max(0, store.currentTime - 5));
          return;
        case "ArrowRight":
          e.preventDefault();
          store.seek(store.currentTime + 5);
          return;
        case "ArrowUp":
          e.preventDefault();
          store.setVolume(Math.min(1, store.volume + 0.05));
          return;
        case "ArrowDown":
          e.preventDefault();
          store.setVolume(Math.max(0, store.volume - 0.05));
          return;
        case "KeyM":
          e.preventDefault();
          store.toggleMute();
          return;
        case "KeyN":
          e.preventDefault();
          store.next();
          return;
        case "KeyP":
          e.preventDefault();
          store.prev();
          return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
