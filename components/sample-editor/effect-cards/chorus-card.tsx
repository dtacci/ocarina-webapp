"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "chorus" }>;
  onChange: (node: Extract<EffectNode, { kind: "chorus" }>) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

const R = EFFECT_RANGES.chorus;

export function ChorusCard({ node, onChange, onRemove, reorder }: Props) {
  return (
    <EffectCard
      label="CHORUS"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      onRemove={onRemove}
      reorder={reorder}
    >
      <div className="flex items-start gap-4">
        <Knob
          label="RATE"
          value={node.rateHz}
          min={R.rateHz.min}
          max={R.rateHz.max}
          defaultValue={R.rateHz.default}
          step={0.1}
          decimals={1}
          unit="Hz"
          onChange={(v) => onChange({ ...node, rateHz: v })}
        />
        <Knob
          label="DEPTH"
          value={node.depth}
          min={R.depth.min}
          max={R.depth.max}
          defaultValue={R.depth.default}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)} %`}
          onChange={(v) => onChange({ ...node, depth: v })}
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
