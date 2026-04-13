"use client";

/**
 * Module-singleton HTML5 audio engine backing the global player store.
 *
 * Why plain <audio>, not WaveSurfer: lighter, unlocks Media Session API,
 * and lets detail-page WaveSurfer visualizers bind to this same element
 * via WaveSurfer's `media` option — no second decode, single source of
 * truth for playback.
 *
 * The engine is imperative and UI-agnostic. It reports events back to the
 * audio-player store; the provider translates store `intent` changes into
 * engine calls.
 */

import type { PlayerStatus } from "@/lib/stores/audio-player";

export interface EngineCallbacks {
  onTimeUpdate: (seconds: number) => void;
  onDuration: (seconds: number) => void;
  onStatus: (status: PlayerStatus) => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

let element: HTMLAudioElement | null = null;
let callbacks: EngineCallbacks | null = null;
let lastEmittedTime = 0;
let timeEmitHandle: number | null = null;

const TIME_EMIT_INTERVAL_MS = 250;

function emitTimeThrottled(now: number) {
  if (timeEmitHandle !== null) return;
  timeEmitHandle = window.setTimeout(() => {
    timeEmitHandle = null;
    if (element) callbacks?.onTimeUpdate(element.currentTime);
  }, Math.max(0, TIME_EMIT_INTERVAL_MS - (performance.now() - now)));
}

function attachListeners(el: HTMLAudioElement) {
  el.addEventListener("loadstart", () => callbacks?.onStatus("loading"));
  el.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(el.duration)) callbacks?.onDuration(el.duration);
  });
  el.addEventListener("durationchange", () => {
    if (Number.isFinite(el.duration)) callbacks?.onDuration(el.duration);
  });
  el.addEventListener("canplay", () => {
    if (!el.paused) callbacks?.onStatus("playing");
    else callbacks?.onStatus("paused");
  });
  el.addEventListener("waiting", () => callbacks?.onStatus("buffering"));
  el.addEventListener("stalled", () => callbacks?.onStatus("buffering"));
  el.addEventListener("playing", () => callbacks?.onStatus("playing"));
  el.addEventListener("play", () => callbacks?.onStatus("playing"));
  el.addEventListener("pause", () => {
    // `ended` also fires `pause`; the `ended` handler wins below.
    if (!el.ended) callbacks?.onStatus("paused");
  });
  el.addEventListener("ended", () => callbacks?.onEnded());
  el.addEventListener("timeupdate", () => {
    // Throttle to ~4 Hz to keep React churn low.
    const t = el.currentTime;
    if (Math.abs(t - lastEmittedTime) < 0.25) return;
    lastEmittedTime = t;
    emitTimeThrottled(performance.now());
  });
  el.addEventListener("error", () => {
    const code = el.error?.code;
    const map: Record<number, string> = {
      1: "Aborted",
      2: "Network error — check connection",
      3: "Audio decode failed",
      4: "Audio format not supported or source unavailable",
    };
    callbacks?.onError(code ? map[code] ?? "Audio error" : "Audio error");
  });
}

function ensureElement(): HTMLAudioElement {
  if (element) return element;
  const el = document.createElement("audio");
  el.preload = "metadata";
  el.crossOrigin = "anonymous";
  // Do NOT attach to DOM — the element works headlessly. Detail-page
  // WaveSurfers will bind to it via WaveSurfer's `media` option.
  attachListeners(el);
  element = el;
  return el;
}

export const audioEngine = {
  register(cb: EngineCallbacks) {
    callbacks = cb;
    ensureElement();
  },

  getElement(): HTMLAudioElement | null {
    return element;
  },

  load(src: string, autoplay: boolean) {
    const el = ensureElement();
    if (el.src !== src) {
      el.src = src;
      el.load();
    }
    callbacks?.onStatus("loading");
    if (autoplay) {
      // Must be invoked from within a user-gesture stack for iOS.
      void el.play().catch((err) => {
        callbacks?.onError(
          err?.name === "NotAllowedError"
            ? "Tap play to start audio"
            : "Playback failed",
        );
      });
    }
  },

  play() {
    const el = element;
    if (!el) return;
    void el.play().catch((err) => {
      callbacks?.onError(
        err?.name === "NotAllowedError"
          ? "Tap play to start audio"
          : "Playback failed",
      );
    });
  },

  pause() {
    element?.pause();
  },

  stop() {
    const el = element;
    if (!el) return;
    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      // Safari can throw if metadata not loaded yet — harmless.
    }
  },

  seek(seconds: number) {
    const el = element;
    if (!el) return;
    try {
      el.currentTime = seconds;
      lastEmittedTime = seconds;
      callbacks?.onTimeUpdate(seconds);
    } catch {
      // Ignore — will settle on next loadedmetadata.
    }
  },

  setVolume(volume: number) {
    if (!element) return;
    element.volume = Math.min(1, Math.max(0, volume));
  },

  setMuted(muted: boolean) {
    if (!element) return;
    element.muted = muted;
  },

  destroy() {
    if (timeEmitHandle !== null) {
      clearTimeout(timeEmitHandle);
      timeEmitHandle = null;
    }
    element?.pause();
    if (element) element.src = "";
    element = null;
    callbacks = null;
    lastEmittedTime = 0;
  },
};
