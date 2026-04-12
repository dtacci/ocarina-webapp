"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KaraokePlayer } from "./karaoke-player";
import { LyricsDisplay } from "./lyrics-display";
import { BeatIndicator } from "./beat-indicator";
import { parseLrc } from "@/lib/utils/lrc";
import type { KaraokeSongRow } from "@/lib/db/queries/karaoke";

interface Props {
  song: KaraokeSongRow;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  instrumental: boolean;
}

export function KaraokeSession({ song, syncedLyrics, plainLyrics, instrumental }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const currentTimeRef = useRef(0);

  const lines = parseLrc(syncedLyrics);

  const handleTimeUpdate = useCallback((t: number) => {
    currentTimeRef.current = t;
    setCurrentTime(t);
  }, []);

  const handleBpmChange = useCallback((b: number) => {
    setBpm(b);
  }, []);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  // Theater mode: dim sidebar/header when playing
  useEffect(() => {
    if (isPlaying) {
      document.body.classList.add("karaoke-theater");
    } else {
      document.body.classList.remove("karaoke-theater");
    }
    return () => { document.body.classList.remove("karaoke-theater"); };
  }, [isPlaying]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      {/* Back navigation */}
      <Link
        href="/karaoke"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Karaoke Library
      </Link>

      {/* Song header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight truncate">{song.title}</h1>
            <p className="text-lg text-muted-foreground mt-1">{song.artist}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
            {song.decade && song.decade !== "unknown" && (
              <Badge variant="secondary">{song.decade}</Badge>
            )}
            {song.key && (
              <Badge variant="outline">{song.key}</Badge>
            )}
            {song.duration_sec && (
              <Badge variant="outline">
                {Math.floor(song.duration_sec / 60)}:{String(song.duration_sec % 60).padStart(2, "0")}
              </Badge>
            )}
          </div>
        </div>

        {song.genre && song.genre.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {song.genre.map((g) => (
              <span key={g} className="text-xs text-muted-foreground/60">{g}</span>
            ))}
          </div>
        )}
      </div>

      {/* Player */}
      <KaraokePlayer
        song={song}
        onTimeUpdate={handleTimeUpdate}
        onBpmChange={handleBpmChange}
        onPlayingChange={handlePlayingChange}
      />

      {/* Beat indicator */}
      <BeatIndicator bpm={bpm} isPlaying={isPlaying} />

      {/* Lyrics */}
      <div className="rounded-xl border bg-card/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/10">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lyrics</span>
          {syncedLyrics ? (
            <span className="text-[10px] text-emerald-500">● Synced</span>
          ) : plainLyrics ? (
            <span className="text-[10px] text-amber-500">● Reading mode</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">Not available</span>
          )}
        </div>
        <LyricsDisplay
          lines={lines}
          plainLyrics={plainLyrics}
          instrumental={instrumental}
          currentTime={currentTime}
          isPlaying={isPlaying}
        />
      </div>
    </div>
  );
}
