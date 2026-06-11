"use client";

/**
 * One CDJ-style deck unit: track display, waveform overview, jog platter +
 * vertical tempo fader, hot-cue pads, and transport (CUE / PLAY / loop).
 *
 * Mixer controls (EQ, filter, channel fader, meter) live in the center
 * mixer column (channel-strip.tsx), Pioneer-style.
 *
 * Transport readout is rAF-driven straight into the DOM — position display
 * never re-renders the panel. The CUE button follows CDJ semantics: paused →
 * set the cue at the playhead; playing → snap back to the cue and pause.
 */
import { useEffect, useRef, useState } from "react";
import type { DjDeck } from "@/lib/audio/dj-engine";
import { WaveformOverview } from "./waveform-overview";
import { JogPlatter } from "./jog-platter";
import { HotCuePads } from "./hot-cue-pads";
import { VerticalFader } from "./vertical-fader";

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
  peaks: number[] | null;
  loading?: boolean;
  onRequestLoad: () => void;
}

export function DeckPanel({
  deck,
  label,
  trackTitle,
  trackBpm,
  peaks,
  loading = false,
  onRequestLoad,
}: DeckPanelProps) {
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [loopBars, setLoopBars] = useState<number | null>(null);
  const [rate, setRate] = useState(1);

  const timeRef = useRef<HTMLSpanElement>(null);
  const bpmRef = useRef<HTMLSpanElement>(null);

  // Position/BPM readout + natural-end detection, all off-state.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = deck.getState();
      if (timeRef.current) {
        timeRef.current.textContent = `${fmt(s.positionSec)} / ${fmt(s.durationSec)}`;
      }
      if (bpmRef.current) {
        bpmRef.current.textContent = trackBpm
          ? `${(trackBpm * s.rate).toFixed(1)} bpm`
          : "--- bpm";
      }
      // Natural end / seek-released loops flip engine state without a UI
      // event — mirror both.
      setPlaying((prev) => (prev === s.playing ? prev : s.playing));
      setLoopBars((prev) => (prev === s.loopBars ? prev : s.loopBars));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deck, trackBpm]);

  const hasTrack = trackTitle !== null;

  return (
    <section
      aria-label={`Deck ${label}`}
      className="min-w-[300px] space-y-3 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] p-4"
    >
      {/* Track display */}
      <div className="flex items-center gap-3 border border-[color:var(--wb-line-soft)] bg-[color:var(--ink-900)] px-3 py-2">
        <span className="workbench-label text-lg text-[color:var(--wb-amber)]">{label}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[color:var(--ink-300)]">
            {loading ? "loading…" : hasTrack ? trackTitle : "no track loaded"}
          </p>
          <p className="workbench-readout text-[10px] text-[color:var(--ink-500)] lowercase">
            <span ref={bpmRef} className="tabular-nums">--- bpm</span>
            {" · "}
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

      {/* Waveform overview (click to seek) */}
      <WaveformOverview peaks={peaks} deck={deck} deckLabel={label} />

      {/* Platter + tempo */}
      <div className="flex items-center justify-center gap-5 py-1">
        <JogPlatter deck={deck} deckLabel={label} />
        <VerticalFader
          value={rate}
          min={0.92}
          max={1.08}
          step={0.001}
          height={150}
          label="tempo"
          ariaLabel={`tempo deck ${label}`}
          defaultValue={1}
          centerDetent
          format={(v) => `${v >= 1 ? "+" : ""}${((v - 1) * 100).toFixed(1)}%`}
          onChange={(v) => {
            setRate(v);
            deck.setRate(v);
          }}
        />
      </div>

      {/* Hot cues */}
      <HotCuePads deck={deck} deckLabel={label} disabled={!hasTrack} />

      {/* Transport */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          disabled={!hasTrack}
          aria-label={`cue deck ${label}`}
          title="paused: set cue at playhead · playing: back to cue"
          className="dj-transport-btn"
          data-lit={false}
          style={
            {
              "--btn-accent": "var(--dj-cue)",
              "--btn-glow": "var(--dj-cue-glow)",
            } as React.CSSProperties
          }
          onClick={() => {
            const s = deck.getState();
            if (s.playing) {
              deck.jumpCue();
              deck.pause();
            } else {
              deck.setCue();
            }
            setPlaying(deck.getState().playing);
          }}
        >
          cue
        </button>
        <button
          type="button"
          disabled={!hasTrack}
          aria-label={playing ? `pause deck ${label}` : `play deck ${label}`}
          className="dj-transport-btn"
          data-lit={playing}
          style={
            {
              "--btn-accent": "var(--dj-play)",
              "--btn-glow": "var(--dj-play-glow)",
            } as React.CSSProperties
          }
          onClick={() => {
            deck.toggle();
            setPlaying(deck.getState().playing);
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        {/* Beat loops — engage at the playhead, length from the track bpm. */}
        <div className="ml-auto flex items-center gap-1">
          {[1, 2, 4].map((bars) => (
            <button
              key={bars}
              type="button"
              disabled={!hasTrack || !trackBpm}
              aria-label={`loop ${bars} bars deck ${label}`}
              aria-pressed={loopBars === bars}
              title={
                trackBpm
                  ? `${bars}-bar loop from the playhead`
                  : "needs a track bpm"
              }
              className="workbench-label border border-[color:var(--wb-line)] px-2 py-1.5 transition-colors hover:border-[color:var(--wb-amber-dim)] disabled:opacity-40 tabular-nums"
              style={{
                color: loopBars === bars ? "var(--wb-amber)" : "var(--ink-500)",
                borderColor: loopBars === bars ? "var(--wb-amber-dim)" : undefined,
              }}
              onClick={() => {
                const next = loopBars === bars ? null : bars;
                deck.setLoopBars(next);
                setLoopBars(deck.getState().loopBars);
              }}
            >
              {bars}
            </button>
          ))}
        </div>
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
    </section>
  );
}
