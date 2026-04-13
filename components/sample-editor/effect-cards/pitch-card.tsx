"use client";

import { EffectCard } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "pitch" }>;
  onChange: (node: Extract<EffectNode, { kind: "pitch" }>) => void;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Returns e.g. "+3 st · D#" for semitone offset (referenced to C). */
function formatSemitones(st: number): string {
  const sign = st > 0 ? "+" : st < 0 ? "" : "±";
  const note = NOTE_NAMES[(((Math.round(st) % 12) + 12) % 12)];
  return `${sign}${st.toFixed(0)} st · ${note}`;
}

export function PitchCard({ node, onChange }: Props) {
  return (
    <EffectCard
      label="PITCH"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
    >
      <div className="flex justify-center">
        <Knob
          label="SEMITONES"
          value={node.semitones}
          min={EFFECT_RANGES.pitch.semitones.min}
          max={EFFECT_RANGES.pitch.semitones.max}
          defaultValue={EFFECT_RANGES.pitch.semitones.default}
          step={1}
          size={64}
          format={formatSemitones}
          onChange={(v) => onChange({ ...node, semitones: v })}
        />
      </div>
    </EffectCard>
  );
}
