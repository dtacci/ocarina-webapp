"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, Volume2, ChevronDown, ChevronUp } from "lucide-react";

// Dynamically imported — only loads in browser
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import { useAudioPlayerStore } from "@/lib/stores/audio-player";

type PlayerState = "loading" | "ready" | "playing" | "paused" | "error";

/**
 * Imperative controls for parents (e.g. click-a-note-to-hear in the
 * transcription view). Handed out via the `registerApi` callback prop rather
 * than a ref because `next/dynamic` doesn't forward refs.
 */
export interface TonePlayerApi {
  /** Jump the transport to `seconds` (playback-rate-adjusted timeline). */
  seekTo: (seconds: number) => void;
  /** Sound a single pitch through the player's synth (respects Key offset). */
  previewNote: (midi: number, durationSec?: number) => void;
}

interface Props {
  midiBlobUrl: string;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onBpmChange: (bpm: number) => void;
  onStateChange: (playing: boolean) => void;
  /**
   * Playback speed multiplier (default 1). Time-stretches the schedule so pitch
   * is preserved (the synth retriggers the same notes, just spaced out). Karaoke
   * passes nothing → 1 → identical to before.
   */
  playbackRate?: number;
  /** Called with the imperative API once mounted (and null on unmount). */
  registerApi?: (api: TonePlayerApi | null) => void;
}

export default function ToneMidiPlayer({
  midiBlobUrl,
  duration,
  onTimeUpdate,
  onBpmChange,
  onStateChange,
  playbackRate = 1,
  registerApi,
}: Props) {
  const [state, setState] = useState<PlayerState>("loading");
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [pitchOffset, setPitchOffset] = useState(0);
  const [volume, setVolume] = useState(80);
  const [bpm, setBpm] = useState(120);

  const partsRef = useRef<Tone.Part[]>([]);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const midiRef = useRef<Midi | null>(null);
  const animRef = useRef<number>(0);
  const pitchRef = useRef(0);

  // Keep pitch ref in sync for live updates
  useEffect(() => { pitchRef.current = pitchOffset; }, [pitchOffset]);

  // Total duration as a ref so the imperative API can clamp without re-binding.
  const totalDurationRef = useRef(totalDuration);
  useEffect(() => { totalDurationRef.current = totalDuration; }, [totalDuration]);

  // Hand the imperative API to the parent (registerApi should be stable —
  // wrap it in useCallback at the call site).
  useEffect(() => {
    if (!registerApi) return;
    registerApi({
      seekTo: (seconds: number) => {
        const t = Math.max(0, Math.min(seconds, totalDurationRef.current || seconds));
        Tone.getTransport().seconds = t;
        setCurrentTime(t);
        onTimeUpdate(t);
      },
      previewNote: (midi: number, durationSec = 0.4) => {
        // A click is a user gesture, so Tone.start() resolves immediately.
        void Tone.start().then(() => {
          const synth = synthRef.current;
          if (!synth) return;
          const note = Tone.Frequency(
            Math.max(21, Math.min(108, midi + pitchRef.current)),
            "midi",
          ).toNote();
          synth.triggerAttackRelease(
            note,
            Math.max(0.15, Math.min(durationSec, 1.5)),
            undefined,
            0.85,
          );
        });
      },
    });
    return () => registerApi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerApi]);

  // Load and parse MIDI
  useEffect(() => {
    let cancelled = false;
    setState("loading");

    (async () => {
      try {
        // NOTE: don't call Tone.start() here — it only resolves after a user
        // gesture, so awaiting it at mount (e.g. when the player auto-appears)
        // would hang the loader forever. The audio context is unlocked in
        // handlePlay() instead, which runs from the play-button click.
        const resp = await fetch(midiBlobUrl);
        if (!resp.ok) throw new Error("fetch failed");
        const buf = await resp.arrayBuffer();
        const midi = new Midi(buf);
        if (cancelled) return;

        midiRef.current = midi;
        const mBpm = midi.header.tempos[0]?.bpm ?? 120;
        const dur = midi.duration;

        setBpm(Math.round(mBpm));
        setTotalDuration((dur || duration) / playbackRate);
        onBpmChange(Math.round(mBpm));

        // Build synth
        const vol = new Tone.Volume(Tone.gainToDb(volume / 100)).toDestination();
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "triangle" as const },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.8 },
        }).connect(vol);
        synth.maxPolyphony = 32;
        synthRef.current = synth;

        // Schedule tracks
        Tone.getTransport().bpm.value = mBpm;
        const parts: Tone.Part[] = [];

        for (const track of midi.tracks) {
          if (track.notes.length === 0) continue;
          const part = new Tone.Part(
            (time, note: { midi: number; duration: number; velocity: number }) => {
              const noteWithOffset = Tone.Frequency(
                Math.max(21, Math.min(108, note.midi + pitchRef.current)),
                "midi"
              ).toNote();
              synth.triggerAttackRelease(noteWithOffset, note.duration + "s", time, note.velocity);
            },
            track.notes.map((n) => ({
              time: n.time / playbackRate + "s",
              midi: n.midi,
              duration: n.duration / playbackRate,
              velocity: n.velocity,
            }))
          );
          part.start(0);
          parts.push(part);
        }

        partsRef.current = parts;
        setState("ready");
      } catch (e) {
        console.error("MIDI load error:", e);
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      partsRef.current.forEach((p) => p.dispose());
      partsRef.current = [];
      synthRef.current?.dispose();
      synthRef.current = null;
      cancelAnimationFrame(animRef.current);
    };
  }, [midiBlobUrl, playbackRate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volume changes
  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = Tone.gainToDb(volume / 100);
    }
  }, [volume]);

  function startRaf() {
    const tick = () => {
      const t = Tone.getTransport().seconds;
      setCurrentTime(t);
      onTimeUpdate(t);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }

  async function handlePlay() {
    if (state === "playing") {
      Tone.getTransport().pause();
      cancelAnimationFrame(animRef.current);
      setState("paused");
      onStateChange(false);
    } else {
      // Mutual exclusion with the global player.
      useAudioPlayerStore.getState().stop();
      await Tone.start();
      Tone.getTransport().start();
      startRaf();
      setState("playing");
      onStateChange(true);
    }
  }

  function handleRestart() {
    Tone.getTransport().stop();
    Tone.getTransport().seconds = 0;
    cancelAnimationFrame(animRef.current);
    setCurrentTime(0);
    onTimeUpdate(0);
    setState("ready");
    onStateChange(false);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = parseFloat(e.target.value);
    Tone.getTransport().seconds = t;
    setCurrentTime(t);
    onTimeUpdate(t);
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border bg-destructive/10 p-4 text-center text-sm text-destructive">
        Failed to load MIDI file. Check the URL or try again.
      </div>
    );
  }

  const isLoading = state === "loading";
  const isPlaying = state === "playing";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Progress bar */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={totalDuration}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          disabled={isLoading}
          className="w-full h-1.5 accent-primary rounded-full bg-muted cursor-pointer disabled:opacity-50"
        />
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(totalDuration)}</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4">
        {/* Restart */}
        <button
          onClick={handleRestart}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 p-1"
          title="Restart"
        >
          <SkipBack className="size-4" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={handlePlay}
          disabled={isLoading}
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
        >
          {isLoading ? (
            <div className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 ml-0.5" />
          )}
        </button>

        {/* Pitch controls */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-muted-foreground mr-1">Key</span>
          <button
            onClick={() => setPitchOffset((p) => Math.max(-6, p - 1))}
            className="flex size-6 items-center justify-center rounded border text-xs hover:bg-muted transition-colors"
            title="Lower pitch"
          >
            <ChevronDown className="size-3" />
          </button>
          <span className="text-xs tabular-nums w-8 text-center">
            {pitchOffset === 0 ? "0" : pitchOffset > 0 ? `+${pitchOffset}` : pitchOffset}
          </span>
          <button
            onClick={() => setPitchOffset((p) => Math.min(6, p + 1))}
            className="flex size-6 items-center justify-center rounded border text-xs hover:bg-muted transition-colors"
            title="Raise pitch"
          >
            <ChevronUp className="size-3" />
          </button>
        </div>

        <div className="flex-1" />

        {/* Volume */}
        <div className="flex items-center gap-2">
          <Volume2 className="size-4 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(parseInt(e.target.value, 10))}
            className="w-20 h-1 accent-primary rounded-full bg-muted cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
