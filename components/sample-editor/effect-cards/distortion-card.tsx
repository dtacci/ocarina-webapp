"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "distortion" }>;
  onChange: (node: Extract<EffectNode, { kind: "distortion" }>) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

const R = EFFECT_RANGES.distortion;

export function DistortionCard({ node, onChange, onRemove, reorder }: Props) {
  return (
    <EffectCard
      label="DISTORT"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      onRemove={onRemove}
      reorder={reorder}
    >
      <div className="flex items-start gap-4">
        <Knob
          label="DRIVE"
          value={node.amount}
          min={R.amount.min}
          max={R.amount.max}
          defaultValue={R.amount.default}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)} %`}
          onChange={(v) => onChange({ ...node, amount: v })}
        />
        <Knob
          label="MIX"
          value={node.wet}
          min={R.wet.min}
          max={R.wet.max}
          defaultValue={R.wet.default}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)} %`}
          onChange={(v) => onChange({ ...node, wet: v })}
        />
      </div>
    </EffectCard>
  );
}
