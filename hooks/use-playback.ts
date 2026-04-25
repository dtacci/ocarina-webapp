"use client";

/**
 * Adapter hook for audio playback — branches between the global audio player
 * (Zustand store + singleton engine) and a local HTMLAudioElement fallback
 * depending on the `globalAudioPlayer` feature flag.
 *
 * Every card/player component calls this once; the JSX doesn't need to know
 * which playback mode is active.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isEnabled } from "@/lib/features";
import {
  useAudioPlayerStore,
  useIsPlaying,
  type Track,
} from "@/lib/stores/audio-player";

export interface PlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  isCurrent: boolean;
  currentTime: number;
  duration: number;
  progress: number;
}

export interface PlaybackActions {
  play: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
}

export type Playback = PlaybackState & PlaybackActions;

interface Options {
  /** Pre-built Track for the global store path. */
  track: Track;
  /** If inside a list context, provide queue + index for next/prev support. */
  listTracks?: Track[];
  listIndex?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global store path — reads from Zustand, dispatches to singleton engine.

function useGlobalPlayback({ track, listTracks, listIndex }: Options): Playback {
  const storeIsPlaying = useIsPlaying(track.id);
  const isCurrent = useAudioPlayerStore((s) => s.current?.id === track.id);
  const isLoading = useAudioPlayerStore(
    (s) => s.current?.id === track.id && s.status === "loading",
  );
  const currentTime = useAudioPlayerStore((s) =>
    s.current?.id === track.id ? s.currentTime : 0,
  );
  const storeDuration = useAudioPlayerStore((s) =>
    s.current?.id === track.id ? s.duration : 0,
  );
  const playList = useAudioPlayerStore((s) => s.playList);
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const clear = useAudioPlayerStore((s) => s.clear);
  const seekStore = useAudioPlayerStore((s) => s.seek);

  const duration = storeDuration > 0 ? storeDuration : (track.duration ?? 0);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const play = useCallback(() => {
    if (listTracks && typeof listIndex === "number" && listIndex >= 0) {
      playList(listTracks, listIndex);
    } else {
      playTrack(track);
    }
  }, [listTracks, listIndex, playList, playTrack, track]);

  const stop = useCallback(() => clear(), [clear]);
  const seek = useCallback((s: number) => seekStore(s), [seekStore]);

  return {
    isPlaying: storeIsPlaying,
    isLoading,
    isCurrent,
    currentTime,
    duration,
    progress,
    play,
    stop,
    seek,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Local playback path — manages a per-component HTMLAudioElement.

function useLocalPlayback({ track }: Options): Playback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(track.duration ?? 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount or src change.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
        audioRef.current = null;
      }
    };
  }, [track.src]);

  const getAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio(track.src);
    a.preload = "metadata";
    a.addEventListener("play", () => {
      setIsPlaying(true);
      setIsLoading(false);
    });
    a.addEventListener("pause", () => setIsPlaying(false));
    a.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });
    a.addEventListener("waiting", () => setIsLoading(true));
    a.addEventListener("canplay", () => setIsLoading(false));
    a.addEventListener("loadedmetadata", () => {
      if (a.duration && Number.isFinite(a.duration)) setDuration(a.duration);
    });
    a.addEventListener("timeupdate", () => setCurrentTime(a.currentTime));
    audioRef.current = a;
    return a;
  }, [track.src]);

  const play = useCallback(() => {
    const a = getAudio();
    if (isPlaying) {
      a.pause();
    } else {
      setIsLoading(true);
      a.play().catch(() => setIsLoading(false));
    }
  }, [getAudio, isPlaying]);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const seek = useCallback(
    (s: number) => {
      const a = audioRef.current;
      if (a) a.currentTime = s;
      setCurrentTime(s);
    },
    [],
  );

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return {
    isPlaying,
    isLoading,
    isCurrent: isPlaying || currentTime > 0,
    currentTime,
    duration,
    progress,
    play,
    stop,
    seek,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — delegates to global or local path based on feature flag.

const globalEnabled = isEnabled("globalAudioPlayer");

export function usePlayback(options: Options): Playback {
  // Hook rules: both paths are called unconditionally. The unused path's
  // state is simply ignored. This is safe because `globalEnabled` is a
  // compile-time constant — the linter won't complain and React can
  // optimise the dead path in production builds.
  const global = useGlobalPlayback(options);
  const local = useLocalPlayback(options);
  return globalEnabled ? global : local;
}
