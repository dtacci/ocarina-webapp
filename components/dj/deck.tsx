"use client";

/**
 * One DJ deck panel: track readout, transport (play/pause, cue, loop),
 * tempo nudge, kill-EQ knobs, bipolar filter knob, channel fader, meter.
 *
 * Knob/fader state lives in React (the UI is the source of truth and pushes
 * into the engine); the transport readout is rAF-driven straight into the
 * DOM — same pattern as the sample editor's timecode — so position display
 * never re-renders the panel.
 */
import { useEffect, useRef, useState } from "react";
import type { DjDeck } from "@/lib/audio/dj-engine";
import { Knob } from "@/components/sample-editor/primitives/knob";
import { LinearSlider } from "@/components/sample-editor/primitives/linear-slider";
import { PeakMeter } from "@/components/sample-editor/peak-meter";

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

export interface DeckPanelProps {
  deck: DjDeck;
  label: "A" | "B";
  trackTitle: string | null;
  trackBpm: number | null;
  loading?: boolean;
  onRequestLoad: () => void;
}

export function DeckPanel({
  deck,
  label,
  trackTitle,
  trackBpm,
  loading = false,
  onRequestLoad,
}: DeckPanelProps) {
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);
  const [eqLow, setEqLow] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);
  const [filter, setFilter] = useState(0);
  const [volume, setVolume] = useState(1);

  const timeRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Position readout + progress bar + natural-end detection, all off-state.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = deck.getState();
      if (timeRef.current) {
        timeRef.current.textContent = `${fmt(s.positionSec)} / ${fmt(s.durationSec)}`;
      }
      if (barRef.current) {
        const pct = s.durationSec > 0 ? (s.positionSec / s.durationSec) * 100 : 0;
        barRef.current.style.width = `${pct}%`;
      }
      // Natural end flips engine state without a UI event — mirror it.
      setPlaying((prev) => (prev === s.playing ? prev : s.playing));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deck]);

  const hasTrack = trackTitle !== null;

  return (
    <section
      aria-label={`Deck ${label}`}
      className="flex-1 min-w-[300px] space-y-4 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] p-4"
    >
      {/* Header: deck letter + track + load */}
      <div className="flex items-center gap-3">
        <span className="workbench-label text-lg text-[color:var(--wb-amber)]">{label}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[color:var(--ink-300)]">
            {loading ? "loading…" : hasTrack ? trackTitle : "no track loaded"}
          </p>
          <p className="workbench-readout text-[10px] text-[color:var(--ink-500)] lowercase">
            {trackBpm ? `${Math.round(trackBpm)} bpm · ` : ""}
            <span ref={timeRef} className="tabular-nums">0:00.0 / 0:00.0</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestLoad}
          disabled={loading}
          className="workbench-label border border-[color:var(--wb-line)] px-2.5 py-1.5 hover:border-[color:var(--wb-amber-dim)] hover:text-[color:var(--wb-amber)] transition-colors disabled:opacity-40"
        >
          load
        </button>
      </div>

      {/* Progress strip */}
      <div className="h-1 w-full bg-[color:var(--ink-900)]">
        <div ref={barRef} className="h-full bg-[color:var(--wb-amber)]" style={{ width: 0 }} />
      </div>

      {/* Transport */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            deck.toggle();
            setPlaying(deck.getState().playing);
          }}
          disabled={!hasTrack}
          aria-label={playing ? `pause deck ${label}` : `play deck ${label}`}
          className="workbench-label min-w-[72px] border border-[color:var(--wb-amber-dim)] px-3 py-1.5 text-left text-[color:var(--wb-amber)] hover:bg-[color:var(--wb-amber-glow)] transition-colors disabled:opacity-40 tabular-nums"
        >
          {playing ? "■ pause" : "▶ play"}
        </button>
        <button
          type="button"
          onClick={() => deck.setCue()}
          disabled={!hasTrack}
          title="Set cue at the playhead"
          className="workbench-label border border-[color:var(--wb-line)] px-2.5 py-1.5 hover:border-[color:var(--ink-500)] transition-colors disabled:opacity-40"
        >
          set cue
        </button>
        <button
          type="button"
          onClick={() => {
            deck.jumpCue();
            setPlaying(deck.getState().playing);
          }}
          disabled={!hasTrack}
          title="Jump to cue"
          className="workbench-label border border-[color:var(--wb-line)] px-2.5 py-1.5 hover:border-[color:var(--ink-500)] transition-colors disabled:opacity-40"
        >
          cue
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !loop;
            setLoop(next);
            deck.setLoop(next);
          }}
          aria-pressed={loop}
          className="workbench-label flex items-center gap-1.5 border border-[color:var(--wb-line)] px-2.5 py-1.5 transition-colors"
          style={{ color: loop ? "var(--wb-amber)" : "var(--ink-500)" }}
        >
          <span className="workbench-led" data-on={loop} />
          loop
        </button>
      </div>

      {/* Tempo nudge */}
      <LinearSlider
        value={rate}
        min={0.92}
        max={1.08}
        step={0.001}
        label="tempo"
        width={180}
        showReadout
        format={(v) => `${v >= 1 ? "+" : ""}${((v - 1) * 100).toFixed(1)}%`}
        onChange={(v) => {
          setRate(v);
          deck.setRate(v);
        }}
      />

      {/* EQ + filter knobs */}
      <div className="flex items-end gap-4">
        <Knob
          label="low" value={eqLow} min={-24} max={6} step={0.5} defaultValue={0}
          unit="dB" decimals={1} showSign size={44}
          onChange={(v) => { setEqLow(v); deck.setEq("low", v); }}
        />
        <Knob
          label="mid" value={eqMid} min={-24} max={6} step={0.5} defaultValue={0}
          unit="dB" decimals={1} showSign size={44}
          onChange={(v) => { setEqMid(v); deck.setEq("mid", v); }}
        />
        <Knob
          label="high" value={eqHigh} min={-24} max={6} step={0.5} defaultValue={0}
          unit="dB" decimals={1} showSign size={44}
          onChange={(v) => { setEqHigh(v); deck.setEq("high", v); }}
        />
        <Knob
          label="filter" value={filter} min={-1} max={1} step={0.02} defaultValue={0}
          size={52}
          format={(v) =>
            Math.abs(v) < 0.03 ? "off" : v < 0 ? `lp ${Math.round(-v * 100)}` : `hp ${Math.round(v * 100)}`
          }
          onChange={(v) => { setFilter(v); deck.setFilter(v); }}
        />
        <div className="ml-auto flex items-end gap-3">
          <LinearSlider
            value={volume}
            min={0}
            max={1.2}
            step={0.01}
            label="level"
            width={110}
            onChange={(v) => { setVolume(v); deck.setVolume(v); }}
          />
          <PeakMeter analyser={deck.analyser} height={48} />
        </div>
      </div>
    </section>
  );
}
