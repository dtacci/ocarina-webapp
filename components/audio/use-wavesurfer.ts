"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";

interface UseWaveSurferOptions {
  url: string;
  height?: number;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  cursorWidth?: number;
  barWidth?: number;
  barGap?: number;
  barRadius?: number;
  /** When true, defers WaveSurfer creation until the container scrolls into view.
   *  Use in list/grid contexts to avoid initializing dozens of instances at once. */
  lazy?: boolean;
}

export function useWaveSurfer({
  url,
  height = 64,
  waveColor = "oklch(0.55 0.02 65)",
  progressColor = "oklch(0.75 0.15 65)",
  cursorColor = "oklch(0.75 0.15 65 / 0.5)",
  cursorWidth = 1,
  barWidth = 3,
  barGap = 1,
  barRadius = 2,
  lazy = false,
}: UseWaveSurferOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Stable options ref so IntersectionObserver callback doesn't capture stale closures
  const optsRef = useRef({
    url, height, waveColor, progressColor, cursorColor, cursorWidth, barWidth, barGap, barRadius,
  });
  useEffect(() => {
    optsRef.current = { url, height, waveColor, progressColor, cursorColor, cursorWidth, barWidth, barGap, barRadius };
  });

  function createWaveSurfer() {
    if (!containerRef.current || wsRef.current) return;
    const opts = optsRef.current;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: opts.height,
      waveColor: opts.waveColor,
      progressColor: opts.progressColor,
      cursorColor: opts.cursorColor,
      cursorWidth: opts.cursorWidth,
      barWidth: opts.barWidth,
      barGap: opts.barGap,
      barRadius: opts.barRadius,
      url: opts.url,
      normalize: true,
      backend: "WebAudio",
    });

    ws.on("ready", () => {
      setIsReady(true);
      setDuration(ws.getDuration());
    });
    ws.on("timeupdate", (time) => setCurrentTime(time));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    wsRef.current = ws;
  }

  useEffect(() => {
    if (!containerRef.current) return;

    let observer: IntersectionObserver | null = null;

    if (lazy) {
      // Create only when the container is visible
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            createWaveSurfer();
            // Once created, no need to keep observing
            observer?.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
    } else {
      createWaveSurfer();
    }

    return () => {
      observer?.disconnect();
      wsRef.current?.destroy();
      wsRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
    };
    // Re-initialize when url changes (lazy or not)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, lazy]);

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    wsRef.current?.setMuted(muted);
  }, []);

  return {
    containerRef,
    isReady,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    setMuted,
  };
}
