"use client";

/**
 * One DJM mixer channel: HI/MID/LOW kill-EQ knob stack, bipolar filter knob,
 * vertical channel fader, and the deck's post-fade meter.
 *
 * Knob/fader state lives in React (UI is the source of truth, pushed into the
 * engine). Known divergence: a hardware pot mapped to "deck filter" drives the
 * engine directly and this knob won't follow — status quo from the MVP,
 * accepted to keep the pot path setState-free.
 */
import { useState } from "react";
import type { DjDeck } from "@/lib/audio/dj-engine";
import { Knob } from "@/components/sample-editor/primitives/knob";
import { PeakMeter } from "@/components/sample-editor/peak-meter";
import { VerticalFader } from "./vertical-fader";

export interface ChannelStripProps {
  deck: DjDeck;
  deckLabel: "A" | "B";
}

export function ChannelStrip({ deck, deckLabel }: ChannelStripProps) {
  const [eqHigh, setEqHigh] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqLow, setEqLow] = useState(0);
  const [filter, setFilter] = useState(0);
  const [volume, setVolume] = useState(1);

  return (
    <div
      role="group"
      aria-label={`channel ${deckLabel}`}
      className="flex flex-col items-center gap-3 border border-[color:var(--wb-line-soft)] bg-[color:var(--ink-900)] px-3 py-3"
    >
      <span className="workbench-label text-[color:var(--wb-amber)]">{deckLabel}</span>
      <Knob
        label="hi" value={eqHigh} min={-24} max={6} step={0.5} defaultValue={0}
        unit="dB" decimals={1} showSign size={38}
        onChange={(v) => { setEqHigh(v); deck.setEq("high", v); }}
      />
      <Knob
        label="mid" value={eqMid} min={-24} max={6} step={0.5} defaultValue={0}
        unit="dB" decimals={1} showSign size={38}
        onChange={(v) => { setEqMid(v); deck.setEq("mid", v); }}
      />
      <Knob
        label="low" value={eqLow} min={-24} max={6} step={0.5} defaultValue={0}
        unit="dB" decimals={1} showSign size={38}
        onChange={(v) => { setEqLow(v); deck.setEq("low", v); }}
      />
      <Knob
        label="filter" value={filter} min={-1} max={1} step={0.02} defaultValue={0}
        size={44}
        format={(v) =>
          Math.abs(v) < 0.03 ? "off" : v < 0 ? `lp ${Math.round(-v * 100)}` : `hp ${Math.round(v * 100)}`
        }
        onChange={(v) => { setFilter(v); deck.setFilter(v); }}
      />
      <div className="flex items-end gap-2 pt-1">
        <VerticalFader
          value={volume}
          min={0}
          max={1.2}
          step={0.01}
          height={130}
          label="level"
          ariaLabel={`level deck ${deckLabel}`}
          defaultValue={1}
          onChange={(v) => { setVolume(v); deck.setVolume(v); }}
        />
        <PeakMeter analyser={deck.analyser} height={130} />
      </div>
    </div>
  );
}
