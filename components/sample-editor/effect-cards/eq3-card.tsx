"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "eq3" }>;
  onChange: (node: Extract<EffectNode, { kind: "eq3" }>) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

const R = EFFECT_RANGES.eq3;

export function Eq3Card({ node, onChange, onRemove, reorder }: Props) {
  return (
    <EffectCard
      label="EQ"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      onRemove={onRemove}
      reorder={reorder}
      minWidth={240}
      advanced={
        <div className="flex items-start gap-4">
          <Knob
            label="LOW X-OVER"
            value={node.lowFreq}
            min={R.lowFreq.min}
            max={R.lowFreq.max}
            defaultValue={R.lowFreq.default}
            step={10}
            decimals={0}
            unit="Hz"
            log
            onChange={(v) => onChange({ ...node, lowFreq: v })}
          />
          <Knob
            label="HIGH X-OVER"
            value={node.highFreq}
            min={R.highFreq.min}
            max={R.highFreq.max}
            defaultValue={R.highFreq.default}
            step={10}
            decimals={0}
            unit="Hz"
            log
            onChange={(v) => onChange({ ...node, highFreq: v })}
          />
        </div>
      }
    >
      <div className="flex items-start gap-4">
        {(["low", "mid", "high"] as const).map((band) => (
          <Knob
            key={band}
            label={band.toUpperCase()}
            value={node[band]}
            min={R[band].min}
            max={R[band].max}
            defaultValue={R[band].default}
            step={0.5}
            decimals={1}
            unit="dB"
            showSign
            onChange={(v) => onChange({ ...node, [band]: v })}
          />
        ))}
      </div>
    </EffectCard>
  );
}
