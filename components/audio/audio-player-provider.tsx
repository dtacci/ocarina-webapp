"use client";

import { useEffect } from "react";
import { audioEngine } from "./audio-engine";
import { useAudioPlayerStore } from "@/lib/stores/audio-player";
import { usePlayerShortcuts } from "@/hooks/use-player-shortcuts";

/**
 * Glue between the Zustand store and the module-singleton audio engine.
 * Mount once inside the dashboard layout. Renders no DOM — it only drives
 * side effects. The visible UI lives in <AudioPlayerBar />.
 *
 * Flow:
 *   UI action → store.intent mutated → this provider's subscribe fires
 *   → engine.<command>() → engine event → store.status/time updated
 *   → UI re-renders via selector.
 *
 * The intent/status split prevents feedback loops: the engine never reads
 * intent and the provider never reads status.
 */
export function AudioPlayerProvider() {
  useEffect(() => {
    const store = useAudioPlayerStore;

    // Dev-only: expose the store on window so it's reachable from DevTools.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { useAudioPlayerStore: typeof store })
        .useAudioPlayerStore = store;
      console.log(
        "[audio-player] provider mounted — window.useAudioPlayerStore ready",
      );
    }

    audioEngine.register({
      onTimeUpdate: store.getState()._onEngineTimeUpdate,
      onDuration: store.getState()._onEngineDuration,
      onStatus: store.getState()._onEngineStatus,
      onEnded: store.getState()._onEngineEnded,
      onError: store.getState()._onEngineError,
    });

    // Apply persisted volume/muted to the freshly-created element.
    const { volume, muted } = store.getState();
    audioEngine.setVolume(volume);
    audioEngine.setMuted(muted);

    const unsubscribe = store.subscribe(
      (s) => s.intent,
      (intent) => {
        switch (intent.tag) {
          case "idle":
            return;
          case "load":
            audioEngine.load(intent.src, intent.autoplay);
            return;
          case "play":
            audioEngine.play();
            return;
          case "pause":
            audioEngine.pause();
            return;
          case "stop":
            audioEngine.stop();
            return;
          case "seek":
            audioEngine.seek(intent.seconds);
            return;
          case "setVolume":
            audioEngine.setVolume(intent.volume);
            return;
          case "setMuted":
            audioEngine.setMuted(intent.muted);
            return;
        }
      },
    );

    return () => {
      unsubscribe();
      audioEngine.destroy();
    };
  }, []);

  // Media Session API — lock-screen controls, Bluetooth headset buttons.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const ms = navigator.mediaSession;
    const store = useAudioPlayerStore;

    const unsubMeta = store.subscribe(
      (s) => s.current,
      (track) => {
        if (!track) {
          ms.metadata = null;
          return;
        }
        ms.metadata = new MediaMetadata({
          title: track.title,
          artist: track.subtitle ?? "Ocarina",
          album: track.kind === "sample" ? "Sample library" : "Recordings",
          artwork: track.artworkUrl
            ? [{ src: track.artworkUrl, sizes: "512x512" }]
            : undefined,
        });
      },
    );

    const unsubStatus = store.subscribe(
      (s) => s.status,
      (status) => {
        ms.playbackState =
          status === "playing"
            ? "playing"
            : status === "paused" || status === "ended"
              ? "paused"
              : "none";
      },
    );

    ms.setActionHandler("play", () => store.getState().toggle());
    ms.setActionHandler("pause", () => store.getState().toggle());
    ms.setActionHandler("previoustrack", () => store.getState().prev());
    ms.setActionHandler("nexttrack", () => store.getState().next());
    ms.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        store.getState().seek(details.seekTime);
      }
    });

    return () => {
      unsubMeta();
      unsubStatus();
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("seekto", null);
      ms.metadata = null;
    };
  }, []);

  usePlayerShortcuts(true);

  return null;
}
