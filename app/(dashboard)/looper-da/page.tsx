"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Play,
  Pause,
  Square,
  Circle,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  RotateCcw,
  Headphones,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Types
interface Track {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  recording: boolean;
  hasAudio: boolean;
  waveformData: number[];
  audioBlob?: Blob;
}

interface Session {
  bpm: number;
  bars: number;
  isPlaying: boolean;
  isRecording: boolean;
  currentBeat: number;
  loopLength: number; // in seconds
}

const TRACK_COLORS = [
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
];

// Subtle background tints for each track lane — matches TRACK_COLORS order
const TRACK_BG_TINTS: Record<string, string> = {
  "bg-emerald-500": "bg-emerald-950/40",
  "bg-amber-500": "bg-amber-950/40",
  "bg-rose-500": "bg-rose-950/40",
  "bg-sky-500": "bg-sky-950/40",
  "bg-violet-500": "bg-violet-950/40",
  "bg-orange-500": "bg-orange-950/40",
  "bg-teal-500": "bg-teal-950/40",
  "bg-pink-500": "bg-pink-950/40",
};

// Seeded pseudo-random number generator (mulberry32) — deterministic on both
// server and client so React hydration values always match.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateWaveform(seed: string, length: number = 200): number[] {
  // Derive a numeric seed from the track id string
  const numericSeed = seed
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rand = seededRandom(numericSeed);
  return Array.from({ length }, (_, i) => {
    const base = 0.3 + rand() * 0.4;
    const wave1 = Math.sin(i * 0.1) * 0.15;
    const wave2 = Math.cos(i * 0.05) * 0.1;
    return Math.max(0.1, Math.min(1, base + wave1 + wave2));
  });
}

// Transport Controls Component
function TransportControls({
  session,
  onPlay,
  onStop,
  onRecord,
}: {
  session: Session;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={session.isPlaying ? "secondary" : "default"}
        size="icon"
        className="size-12 rounded-full"
        onClick={onPlay}
      >
        {session.isPlaying ? (
          <Pause className="size-5" />
        ) : (
          <Play className="size-5 ml-0.5" />
        )}
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="size-12 rounded-full"
        onClick={onStop}
      >
        <Square className="size-4" />
      </Button>

      <Button
        variant={session.isRecording ? "destructive" : "outline"}
        size="icon"
        className={cn(
          "size-12 rounded-full transition-all",
          session.isRecording && "animate-pulse"
        )}
        onClick={onRecord}
      >
        <Circle
          className={cn("size-5", session.isRecording && "fill-current")}
        />
      </Button>
    </div>
  );
}

// BPM Display Component
function BpmDisplay({
  bpm,
  onBpmChange,
}: {
  bpm: number;
  onBpmChange: (bpm: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">
        BPM
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => onBpmChange(Math.max(40, bpm - 1))}
        >
          -
        </Button>
        <span className="w-12 text-center font-mono text-xl font-bold tabular-nums">
          {bpm}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => onBpmChange(Math.min(240, bpm + 1))}
        >
          +
        </Button>
      </div>
    </div>
  );
}

// Time Display Component
function TimeDisplay({
  currentBeat,
  bars,
  bpm,
}: {
  currentBeat: number;
  bars: number;
  bpm: number;
}) {
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const currentBar = Math.floor(currentBeat / beatsPerBar) + 1;
  const beatInBar = (currentBeat % beatsPerBar) + 1;

  const elapsedSeconds = (currentBeat / bpm) * 60;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = Math.floor(elapsedSeconds % 60);
  const ms = Math.floor((elapsedSeconds % 1) * 100);

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-2">
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          Bar
        </span>
        <span className="font-mono text-xl font-bold tabular-nums">
          {currentBar}.{beatInBar}
        </span>
      </div>
      <div className="h-8 w-px bg-border" />
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          Time
        </span>
        <span className="font-mono text-xl font-bold tabular-nums">
          {minutes}:{seconds.toString().padStart(2, "0")}.
          {ms.toString().padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

// Beat Indicator Component
function BeatIndicator({
  currentBeat,
  bars,
}: {
  currentBeat: number;
  bars: number;
}) {
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalBeats }, (_, i) => {
        const isCurrentBeat = i === currentBeat;
        const isDownbeat = i % beatsPerBar === 0;
        return (
          <div
            key={i}
            className={cn(
              "size-2 rounded-full transition-all duration-75",
              isCurrentBeat
                ? "bg-primary scale-150 shadow-lg shadow-primary/50"
                : isDownbeat
                  ? "bg-muted-foreground/40"
                  : "bg-muted-foreground/20"
            )}
          />
        );
      })}
    </div>
  );
}

// Track Header (left column) for a single track
function TrackHeader({
  track,
  isDragging,
  isDragOver,
  onMute,
  onSolo,
  onDelete,
  onVolumeChange,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  track: Track;
  isDragging: boolean;
  isDragOver: boolean;
  onMute: () => void;
  onSolo: () => void;
  onDelete: () => void;
  onVolumeChange: (volume: number) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={cn(
        "group flex h-[88px] w-44 shrink-0 flex-col justify-center gap-2 border-b border-border bg-card px-3 py-3 transition-all select-none",
        track.recording && "border-l-2 border-l-destructive",
        track.muted && "opacity-50",
        isDragging && "opacity-40 scale-[0.98]",
        isDragOver && "border-t-2 border-t-primary"
      )}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
        <div className={cn("size-3 shrink-0 rounded-full", track.color)} />
        <span className="text-sm font-medium truncate">{track.name}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant={track.muted ? "destructive" : "ghost"}
          size="icon"
          className="size-7"
          onClick={onMute}
        >
          {track.muted ? (
            <VolumeX className="size-3.5" />
          ) : (
            <Volume2 className="size-3.5" />
          )}
        </Button>
        <Button
          variant={track.solo ? "secondary" : "ghost"}
          size="icon"
          className={cn("size-7", track.solo && "bg-amber-500/20 text-amber-500")}
          onClick={onSolo}
        >
          <Headphones className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="100"
          value={track.volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        />
        <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
          {track.volume}%
        </span>
      </div>
    </div>
  );
}

// Single waveform row (no playhead/bar-lines — those live in the shared grid)
function WaveformRow({
  track,
  currentBeat,
  totalBeats,
  isPlaying,
}: {
  track: Track;
  currentBeat: number;
  totalBeats: number;
  isPlaying: boolean;
}) {
  const playheadPosition = (currentBeat / totalBeats) * 100;
  const bgTint = TRACK_BG_TINTS[track.color] ?? "bg-muted/30";

  return (
    <div className={cn("relative h-[88px] border-b border-border", bgTint, track.muted && "opacity-50")}>
      {track.hasAudio ? (
        <div className="absolute inset-0 flex items-center gap-px px-2">
          {track.waveformData.map((height, i) => {
            const position = (i / track.waveformData.length) * 100;
            const isPast = position < playheadPosition;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-sm",
                  isPast && isPlaying ? track.color : "bg-muted-foreground/25"
                )}
                style={{ height: `${height * 70}%` }}
              />
            );
          })}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">
            {track.recording ? (
              <span className="flex items-center gap-2">
                <Circle className="size-3 fill-destructive text-destructive animate-pulse" />
                Recording...
              </span>
            ) : (
              "Empty — press record to add audio"
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// Shared track grid: headers on the left, shared waveform canvas on the right
function TrackGrid({
  tracks,
  currentBeat,
  totalBeats,
  bars,
  isPlaying,
  onMute,
  onSolo,
  onDelete,
  onVolumeChange,
  onReorder,
}: {
  tracks: Track[];
  currentBeat: number;
  totalBeats: number;
  bars: number;
  isPlaying: boolean;
  onMute: (id: string) => void;
  onSolo: (id: string) => void;
  onDelete: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const playheadPosition = (currentBeat / totalBeats) * 100;
  const dragSourceId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  return (
    <div className="flex overflow-hidden rounded-xl border border-border bg-card">
      {/* Left: track headers — drag is only enabled here */}
      <div className="flex shrink-0 flex-col border-r border-border">
        {/* Top-left corner header cell to align with ruler */}
        <div className="flex h-7 items-center border-b border-border px-3">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Track</span>
        </div>
        {tracks.map((track) => (
          <TrackHeader
            key={track.id}
            track={track}
            isDragging={dragSourceId.current === track.id}
            isDragOver={dragOverId === track.id}
            onMute={() => onMute(track.id)}
            onSolo={() => onSolo(track.id)}
            onDelete={() => onDelete(track.id)}
            onVolumeChange={(vol) => onVolumeChange(track.id, vol)}
            onDragStart={() => { dragSourceId.current = track.id; }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(track.id); }}
            onDragEnd={() => { dragSourceId.current = null; setDragOverId(null); }}
            onDrop={() => {
              if (dragSourceId.current && dragSourceId.current !== track.id) {
                onReorder(dragSourceId.current, track.id);
              }
              dragSourceId.current = null;
              setDragOverId(null);
            }}
          />
        ))}
      </div>

      {/* Right: shared waveform canvas */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Bar ruler */}
        <div className="relative flex h-7 shrink-0 items-center border-b border-border bg-muted/20">
          {Array.from({ length: bars }, (_, i) => (
            <div
              key={i}
              className="flex-1 flex items-center border-l border-border/60 pl-1.5"
            >
              <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
            </div>
          ))}
        </div>

        {/* Waveform rows */}
        <div className="relative flex flex-col">
          {tracks.map((track) => (
            <WaveformRow
              key={track.id}
              track={track}
              currentBeat={currentBeat}
              totalBeats={totalBeats}
              isPlaying={isPlaying}
            />
          ))}

          {/* Bar lines — span every row */}
          <div className="pointer-events-none absolute inset-0 flex">
            {Array.from({ length: bars }, (_, i) => (
              <div
                key={i}
                className="flex-1 border-l border-border/40 first:border-l-0"
              />
            ))}
          </div>

          {/* Beat subdivision lines (every beat within each bar) */}
          <div className="pointer-events-none absolute inset-0 flex">
            {Array.from({ length: bars * 4 }, (_, i) => {
              const isBarLine = i % 4 === 0;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 border-l",
                    isBarLine ? "border-border/0" : "border-border/20 border-dashed"
                  )}
                />
              );
            })}
          </div>

          {/* Playhead — spans all rows */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-foreground/90 shadow-[0_0_6px_1px_hsl(var(--foreground)/0.3)] transition-[left] duration-75"
            style={{ left: `${playheadPosition}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Main LooperDA Component
export default function LooperDAPage() {
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: "1",
      name: "Drums",
      color: TRACK_COLORS[0],
      muted: false,
      solo: false,
      volume: 80,
      recording: false,
      hasAudio: true,
      waveformData: generateWaveform("1"),
    },
    {
      id: "2",
      name: "Bass",
      color: TRACK_COLORS[1],
      muted: false,
      solo: false,
      volume: 75,
      recording: false,
      hasAudio: true,
      waveformData: generateWaveform("2"),
    },
    {
      id: "3",
      name: "Synth Lead",
      color: TRACK_COLORS[2],
      muted: false,
      solo: false,
      volume: 65,
      recording: false,
      hasAudio: false,
      waveformData: [],
    },
  ]);

  const [session, setSession] = useState<Session>({
    bpm: 120,
    bars: 4,
    isPlaying: false,
    isRecording: false,
    currentBeat: 0,
    loopLength: 8,
  });

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const beatAccumulatorRef = useRef<number>(0);

  // Calculate beat duration in ms
  const beatDuration = (60 / session.bpm) * 1000;
  const totalBeats = session.bars * 4;

  // Animation loop for playback
  useEffect(() => {
    if (!session.isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      beatAccumulatorRef.current += delta;

      if (beatAccumulatorRef.current >= beatDuration) {
        beatAccumulatorRef.current -= beatDuration;
        setSession((prev) => ({
          ...prev,
          currentBeat: (prev.currentBeat + 1) % totalBeats,
        }));
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [session.isPlaying, beatDuration, totalBeats]);

  // Handlers
  const handlePlay = useCallback(() => {
    if (!session.isPlaying) {
      lastTimeRef.current = 0;
      beatAccumulatorRef.current = 0;
    }
    setSession((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [session.isPlaying]);

  const handleStop = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      isPlaying: false,
      isRecording: false,
      currentBeat: 0,
    }));
    setTracks((prev) =>
      prev.map((t) => ({ ...t, recording: false }))
    );
    lastTimeRef.current = 0;
    beatAccumulatorRef.current = 0;
  }, []);

  const handleRecord = useCallback(() => {
    setSession((prev) => {
      const newRecording = !prev.isRecording;
      return {
        ...prev,
        isRecording: newRecording,
        isPlaying: newRecording ? true : prev.isPlaying,
      };
    });

    // Find first empty track and start recording on it
    setTracks((prev) => {
      const emptyTrackIndex = prev.findIndex((t) => !t.hasAudio);
      if (emptyTrackIndex === -1) return prev;

      return prev.map((t, i) => ({
        ...t,
        recording: i === emptyTrackIndex && !session.isRecording,
      }));
    });
  }, [session.isRecording]);

  const handleBpmChange = useCallback((newBpm: number) => {
    setSession((prev) => ({ ...prev, bpm: newBpm }));
  }, []);

  const handleAddTrack = useCallback(() => {
    const id = Date.now().toString();
    const newTrack: Track = {
      id,
      name: `Track ${tracks.length + 1}`,
      color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      muted: false,
      solo: false,
      volume: 75,
      recording: false,
      hasAudio: false,
      waveformData: generateWaveform(id),
    };
    setTracks((prev) => [...prev, newTrack]);
  }, [tracks.length]);

  const handleMuteTrack = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t))
    );
  }, []);

  const handleSoloTrack = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t))
    );
  }, []);

  const handleDeleteTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleVolumeChange = useCallback((id: string, volume: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, volume } : t))
    );
  }, []);

  const handleReorder = useCallback((fromId: string, toId: string) => {
    setTracks((prev) => {
      const fromIndex = prev.findIndex((t) => t.id === fromId);
      const toIndex = prev.findIndex((t) => t.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        hasAudio: false,
        waveformData: [],
        recording: false,
      }))
    );
    handleStop();
  }, [handleStop]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">LooperDA</h1>
            <p className="text-muted-foreground">
              Multi-track loop station inspired by GarageBand
            </p>
          </div>
          <Badge variant="secondary" className="ml-2">
            Beta
          </Badge>
        </div>
      </div>

      {/* Transport Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card/50 p-4 backdrop-blur">
        <TransportControls
          session={session}
          onPlay={handlePlay}
          onStop={handleStop}
          onRecord={handleRecord}
        />

        <BeatIndicator currentBeat={session.currentBeat} bars={session.bars} />

        <div className="flex items-center gap-4">
          <BpmDisplay bpm={session.bpm} onBpmChange={handleBpmChange} />
          <TimeDisplay
            currentBeat={session.currentBeat}
            bars={session.bars}
            bpm={session.bpm}
          />
        </div>
      </div>

      {/* Loop Length Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Loop Length:</span>
        <div className="flex gap-1">
          {[2, 4, 8, 16].map((bars) => (
            <Button
              key={bars}
              variant={session.bars === bars ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSession((prev) => ({ ...prev, bars }))}
            >
              {bars} bars
            </Button>
          ))}
        </div>
      </div>

      {/* Track Grid */}
      <TrackGrid
        tracks={tracks}
        currentBeat={session.currentBeat}
        totalBeats={totalBeats}
        bars={session.bars}
        isPlaying={session.isPlaying}
        onMute={handleMuteTrack}
        onSolo={handleSoloTrack}
        onDelete={handleDeleteTrack}
        onVolumeChange={handleVolumeChange}
        onReorder={handleReorder}
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={handleAddTrack}>
          <Plus className="size-4 mr-2" />
          Add Track
        </Button>
        <Button variant="ghost" onClick={handleClearAll}>
          <RotateCcw className="size-4 mr-2" />
          Clear All
        </Button>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            {tracks.length} track{tracks.length !== 1 && "s"}
          </span>
          <span>{tracks.filter((t) => t.hasAudio).length} with audio</span>
        </div>
        <div className="flex items-center gap-2">
          {session.isRecording && (
            <Badge variant="destructive" className="animate-pulse">
              Recording
            </Badge>
          )}
          {session.isPlaying && !session.isRecording && (
            <Badge variant="secondary">Playing</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
