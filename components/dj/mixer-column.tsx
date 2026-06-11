"use client";

/**
 * The DJM-style center column: master fader + meter on top, the two channel
 * strips side by side, crossfader at the bottom.
 */
import type { DjEngine } from "@/lib/audio/dj-engine";
import { ChannelStrip } from "./channel-strip";
import { Crossfader } from "./crossfader";
import { VerticalFader } from "./vertical-fader";
import { PeakMeter } from "@/components/sample-editor/peak-meter";

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
  return (
    <div className="flex w-fit flex-col gap-3 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] p-4">
      {/* Master */}
      <div className="flex items-end justify-center gap-2 border-b border-[color:var(--wb-line-soft)] pb-3">
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
