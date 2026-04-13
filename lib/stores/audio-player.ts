"use client";

import { create } from "zustand";
import {
  persist,
  subscribeWithSelector,
  createJSONStorage,
} from "zustand/middleware";

export type TrackKind = "sample" | "recording";

export interface Track {
  id: string;
  kind: TrackKind;
  title: string;
  subtitle?: string;
  src: string;
  peaks?: number[];
  duration?: number;
  artworkUrl?: string;
  href?: string;
}

export interface LastTrackSnapshot {
  id: string;
  kind: TrackKind;
  title: string;
  subtitle?: string;
  href?: string;
  artworkUrl?: string;
}

export type PlayerStatus =
  | "idle"
  | "loading"
  | "buffering"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type Intent =
  | { tag: "idle" }
  | { tag: "load"; src: string; trackId: string; autoplay: boolean }
  | { tag: "play" }
  | { tag: "pause" }
  | { tag: "stop" }
  | { tag: "seek"; seconds: number }
  | { tag: "setVolume"; volume: number }
  | { tag: "setMuted"; muted: boolean };

interface PlayerState {
  current: Track | null;
  queue: Track[];
  queueIndex: number;
  status: PlayerStatus;
  intent: Intent;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  error: string | null;
  hasHydrated: boolean;
  lastTrack: LastTrackSnapshot | null;

  playTrack: (track: Track) => void;
  playList: (queue: Track[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setLoop: (loop: boolean) => void;
  stop: () => void;
  clear: () => void;

  _onEngineTimeUpdate: (t: number) => void;
  _onEngineDuration: (d: number) => void;
  _onEngineStatus: (s: PlayerStatus) => void;
  _onEngineEnded: () => void;
  _onEngineError: (msg: string) => void;
  _setHasHydrated: (v: boolean) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toSnapshot = (t: Track): LastTrackSnapshot => ({
  id: t.id,
  kind: t.kind,
  title: t.title,
  subtitle: t.subtitle,
  href: t.href,
  artworkUrl: t.artworkUrl,
});

export const useAudioPlayerStore = create<PlayerState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        current: null,
        queue: [],
        queueIndex: -1,
        status: "idle",
        intent: { tag: "idle" },
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        muted: false,
        loop: false,
        error: null,
        hasHydrated: false,
        lastTrack: null,

        playTrack: (track) => {
          const { current, status } = get();
          // Same-track click: toggle, don't reload
          if (current?.id === track.id) {
            if (status === "playing") {
              set({ intent: { tag: "pause" } });
            } else if (status === "ended") {
              set({
                intent: { tag: "seek", seconds: 0 },
                currentTime: 0,
              });
              queueMicrotask(() => set({ intent: { tag: "play" } }));
            } else {
              set({ intent: { tag: "play" } });
            }
            return;
          }
          set({
            current: track,
            queue: [track],
            queueIndex: 0,
            status: "loading",
            currentTime: 0,
            duration: track.duration ?? 0,
            error: null,
            lastTrack: toSnapshot(track),
            intent: {
              tag: "load",
              src: track.src,
              trackId: track.id,
              autoplay: true,
            },
          });
        },

        playList: (queue, startIndex = 0) => {
          if (queue.length === 0) return;
          const idx = clamp(startIndex, 0, queue.length - 1);
          const track = queue[idx];
          const { current, status } = get();
          if (current?.id === track.id && status !== "error") {
            // Re-entering same track from a list context: just keep playing.
            if (status === "paused" || status === "ended") {
              set({ intent: { tag: "play" }, queue, queueIndex: idx });
            } else {
              set({ queue, queueIndex: idx });
            }
            return;
          }
          set({
            current: track,
            queue,
            queueIndex: idx,
            status: "loading",
            currentTime: 0,
            duration: track.duration ?? 0,
            error: null,
            lastTrack: toSnapshot(track),
            intent: {
              tag: "load",
              src: track.src,
              trackId: track.id,
              autoplay: true,
            },
          });
        },

        toggle: () => {
          const { current, status } = get();
          if (!current) return;
          if (status === "playing") {
            set({ intent: { tag: "pause" } });
          } else if (status === "ended") {
            set({ intent: { tag: "seek", seconds: 0 }, currentTime: 0 });
            queueMicrotask(() => set({ intent: { tag: "play" } }));
          } else {
            set({ intent: { tag: "play" } });
          }
        },

        next: () => {
          const { queue, queueIndex } = get();
          const nextIdx = queueIndex + 1;
          if (nextIdx >= queue.length) return;
          const track = queue[nextIdx];
          set({
            current: track,
            queueIndex: nextIdx,
            status: "loading",
            currentTime: 0,
            duration: track.duration ?? 0,
            error: null,
            lastTrack: toSnapshot(track),
            intent: {
              tag: "load",
              src: track.src,
              trackId: track.id,
              autoplay: true,
            },
          });
        },

        prev: () => {
          const { queue, queueIndex, currentTime } = get();
          // Spotify-style: if >3s in, restart current instead of going back.
          if (currentTime > 3) {
            set({ intent: { tag: "seek", seconds: 0 }, currentTime: 0 });
            return;
          }
          const prevIdx = queueIndex - 1;
          if (prevIdx < 0) {
            set({ intent: { tag: "seek", seconds: 0 }, currentTime: 0 });
            return;
          }
          const track = queue[prevIdx];
          set({
            current: track,
            queueIndex: prevIdx,
            status: "loading",
            currentTime: 0,
            duration: track.duration ?? 0,
            error: null,
            lastTrack: toSnapshot(track),
            intent: {
              tag: "load",
              src: track.src,
              trackId: track.id,
              autoplay: true,
            },
          });
        },

        seek: (seconds) => {
          const { duration } = get();
          const max = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
          const clamped = clamp(seconds, 0, max);
          set({
            currentTime: clamped,
            intent: { tag: "seek", seconds: clamped },
          });
        },

        setVolume: (volume) => {
          const v = clamp(volume, 0, 1);
          set({ volume: v, intent: { tag: "setVolume", volume: v } });
        },

        toggleMute: () => {
          const next = !get().muted;
          set({ muted: next, intent: { tag: "setMuted", muted: next } });
        },

        setLoop: (loop) => set({ loop }),

        stop: () => {
          const { current } = get();
          if (!current) return;
          set({
            status: "idle",
            currentTime: 0,
            intent: { tag: "stop" },
          });
        },

        clear: () => {
          set({
            current: null,
            queue: [],
            queueIndex: -1,
            status: "idle",
            currentTime: 0,
            duration: 0,
            error: null,
            intent: { tag: "stop" },
          });
        },

        _onEngineTimeUpdate: (t) => set({ currentTime: t }),
        _onEngineDuration: (d) => set({ duration: d }),
        _onEngineStatus: (s) => set({ status: s }),
        _onEngineEnded: () => {
          const { loop, queue, queueIndex } = get();
          if (loop) {
            set({
              currentTime: 0,
              intent: { tag: "seek", seconds: 0 },
            });
            queueMicrotask(() => set({ intent: { tag: "play" } }));
            return;
          }
          if (queueIndex + 1 < queue.length) {
            get().next();
            return;
          }
          set({ status: "ended", currentTime: 0 });
        },
        _onEngineError: (msg) =>
          set({ status: "error", error: msg, intent: { tag: "stop" } }),
        _setHasHydrated: (v) => set({ hasHydrated: v }),
      }),
      {
        name: "audio-player",
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({
          volume: s.volume,
          muted: s.muted,
          lastTrack: s.lastTrack,
        }),
      },
    ),
  ),
);

if (typeof window !== "undefined") {
  const store = useAudioPlayerStore;
  if (store.persist.hasHydrated()) {
    store.setState({ hasHydrated: true });
  } else {
    store.persist.onFinishHydration(() => {
      store.setState({ hasHydrated: true });
    });
  }
}

// Selector hooks — keep re-renders tight by picking only what you need.

export const useNowPlaying = () =>
  useAudioPlayerStore((s) => s.current);

export const useIsPlaying = (trackId: string | null | undefined): boolean =>
  useAudioPlayerStore(
    (s) =>
      !!trackId &&
      s.current?.id === trackId &&
      (s.status === "playing" || s.status === "buffering"),
  );

export const useTransport = () =>
  useAudioPlayerStore((s) => ({
    status: s.status,
    currentTime: s.currentTime,
    duration: s.duration,
  }));

export const useVolumeState = () =>
  useAudioPlayerStore((s) => ({ volume: s.volume, muted: s.muted }));

export const useQueueLength = () =>
  useAudioPlayerStore((s) => s.queue.length);

export const useHasHydrated = () =>
  useAudioPlayerStore((s) => s.hasHydrated);

export const useLastTrack = () =>
  useAudioPlayerStore((s) => s.lastTrack);
