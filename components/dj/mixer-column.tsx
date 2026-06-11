"use client";

/**
 * The DJM-style center column: master fader + meter + REC on top, the two
 * channel strips side by side, crossfader at the bottom.
 *
 * REC captures the master bus live (MediaRecorder via Tone.Recorder), then
 * decodes the compressed take and re-encodes PCM16 WAV for the library —
 * same client-side division of labor as the track editor's mixdown save.
 */
import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import type { DjEngine } from "@/lib/audio/dj-engine";
import { computePeaksFromBuffer } from "@/lib/audio/compute-peaks";
import { encodeWav } from "@/lib/audio/wav-encoder";
import { ChannelStrip } from "./channel-strip";
import { Crossfader } from "./crossfader";
import { VerticalFader } from "./vertical-fader";
import { PeakMeter } from "@/components/sample-editor/peak-meter";

type RecPhase = "idle" | "recording" | "saving" | "saved" | "error";

export interface MixerColumnProps {
  engine: DjEngine;
  xfade: number;
  onXfadeChange: (v: number) => void;
  onXfadeDragStart: () => void;
  onXfadeDragEnd: () => void;
  hwActive: boolean;
  masterVol: number;
  onMasterVol: (v: number) => void;
}

export function MixerColumn({
  engine,
  xfade,
  onXfadeChange,
  onXfadeDragStart,
  onXfadeDragEnd,
  hwActive,
  masterVol,
  onMasterVol,
}: MixerColumnProps) {
  const [recPhase, setRecPhase] = useState<RecPhase>("idle");
  const [recError, setRecError] = useState<string | null>(null);
  const recStartedAtRef = useRef(0);
  const recTimeRef = useRef<HTMLSpanElement>(null);

  // Elapsed-time readout while recording — direct DOM, off React state.
  useEffect(() => {
    if (recPhase !== "recording") return;
    const iv = setInterval(() => {
      if (recTimeRef.current) {
        const s = (Date.now() - recStartedAtRef.current) / 1000;
        recTimeRef.current.textContent = `${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, "0")}`;
      }
    }, 250);
    return () => clearInterval(iv);
  }, [recPhase]);

  const toggleRecording = async () => {
    if (recPhase === "recording") {
      setRecPhase("saving");
      try {
        const blob = await engine.stopRecording();
        const bytes = await blob.arrayBuffer();
        const buffer = await Tone.getContext().rawContext.decodeAudioData(bytes);
        const wav = encodeWav(buffer);
        const form = new FormData();
        form.append("wav", new Blob([wav], { type: "audio/wav" }));
        form.append("name", `DJ mix ${new Date().toLocaleString()}`);
        form.append("durationSec", String(buffer.duration));
        form.append("sampleRate", String(buffer.sampleRate));
        form.append("waveformPeaks", JSON.stringify(computePeaksFromBuffer(buffer)));
        const res = await fetch("/api/dj/recordings", { method: "POST", body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        setRecPhase("saved");
      } catch (err) {
        setRecError(err instanceof Error ? err.message : "save failed");
        setRecPhase("error");
      }
      return;
    }
    setRecError(null);
    try {
      await Tone.start(); // REC is a user gesture — unlock here too
      await engine.startRecording();
      recStartedAtRef.current = Date.now();
      setRecPhase("recording");
    } catch (err) {
      setRecError(err instanceof Error ? err.message : "couldn't start recording");
      setRecPhase("error");
    }
  };

  return (
    <div className="flex w-fit flex-col gap-3 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] p-4">
      {/* Master + REC */}
      <div className="flex items-end justify-center gap-3 border-b border-[color:var(--wb-line-soft)] pb-3">
        <VerticalFader
          value={masterVol}
          min={0}
          max={1.2}
          step={0.01}
          height={72}
          label="master"
          defaultValue={1}
          onChange={onMasterVol}
        />
        <PeakMeter analyser={engine.masterAnalyser} height={72} />
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label={recPhase === "recording" ? "stop recording" : "record mix"}
            aria-pressed={recPhase === "recording"}
            disabled={recPhase === "saving"}
            title="record the master output to your library"
            className="dj-transport-btn !h-10 !w-10"
            data-lit={recPhase === "recording"}
            style={
              {
                "--btn-accent": "var(--wb-oxide)",
                "--btn-glow": "oklch(0.55 0.19 28 / 0.4)",
              } as React.CSSProperties
            }
            onClick={() => void toggleRecording()}
          >
            ●
          </button>
          <span className="workbench-label text-[9px]">
            {recPhase === "recording" ? (
              <span ref={recTimeRef} className="text-[color:var(--wb-oxide)] tabular-nums">0:00</span>
            ) : recPhase === "saving" ? (
              "saving…"
            ) : recPhase === "saved" ? (
              <span className="text-[color:var(--wb-moss)]">saved</span>
            ) : recPhase === "error" ? (
              <span className="text-[color:var(--wb-oxide)]" title={recError ?? undefined}>failed</span>
            ) : (
              "rec"
            )}
          </span>
        </div>
      </div>

      {/* Channels */}
      <div className="flex gap-3">
        <ChannelStrip deck={engine.decks.a} deckLabel="A" />
        <ChannelStrip deck={engine.decks.b} deckLabel="B" />
      </div>

      {/* Crossfader */}
      <div className="border-t border-[color:var(--wb-line-soft)] pt-3">
        <Crossfader
          value={xfade}
          onChange={onXfadeChange}
          onDragStart={onXfadeDragStart}
          onDragEnd={onXfadeDragEnd}
          hwActive={hwActive}
        />
      </div>
    </div>
  );
}
