"use client";

import { EffectCard } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "gain" }>;
  onChange: (node: Extract<EffectNode, { kind: "gain" }>) => void;
}

function formatDb(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)} dB`;
}

export function GainCard({ node, onChange }: Props) {
  return (
    <EffectCard
      label="GAIN"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
    >
      <div className="flex justify-center">
        <Knob
          label="LEVEL"
          value={node.db}
          min={EFFECT_RANGES.gain.db.min}
          max={EFFECT_RANGES.gain.db.max}
          defaultValue={EFFECT_RANGES.gain.db.default}
          step={0.5}
          decimals={1}
          size={64}
          format={formatDb}
          onChange={(v) => onChange({ ...node, db: v })}
        />
      </div>
    </EffectCard>
  );
}
