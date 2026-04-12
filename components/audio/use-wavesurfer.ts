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
}: UseWaveSurferOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height,
      waveColor,
      progressColor,
      cursorColor,
      cursorWidth,
      barWidth,
      barGap,
      barRadius,
      url,
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

    return () => {
      ws.destroy();
      wsRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
    };
  }, [url, height, waveColor, progressColor, cursorColor, cursorWidth, barWidth, barGap, barRadius]);

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
