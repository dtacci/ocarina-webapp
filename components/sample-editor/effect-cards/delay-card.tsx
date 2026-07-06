"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "delay" }>;
  onChange: (node: Extract<EffectNode, { kind: "delay" }>) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

const R = EFFECT_RANGES.delay;

export function DelayCard({ node, onChange, onRemove, reorder }: Props) {
  return (
    <EffectCard
      label="DELAY"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      onRemove={onRemove}
      reorder={reorder}
    >
      <div className="flex items-start gap-4">
        <Knob
          label="TIME"
          value={node.timeSec * 1000}
          min={R.timeSec.min * 1000}
          max={R.timeSec.max * 1000}
          defaultValue={R.timeSec.default * 1000}
          step={1}
          decimals={0}
          unit="ms"
          log
          onChange={(v) => onChange({ ...node, timeSec: v / 1000 })}
        />
        <Knob
          label="FEEDBACK"
          value={node.feedback}
          min={R.feedback.min}
          max={R.feedback.max}
          defaultValue={R.feedback.default}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)} %`}
          onChange={(v) => onChange({ ...node, feedback: v })}
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
