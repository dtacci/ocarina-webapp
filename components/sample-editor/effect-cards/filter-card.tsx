"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { SegmentedGroup } from "../primitives/segmented-group";
import { EFFECT_RANGES, type EffectNode, type FilterMode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "filter" }>;
  onChange: (node: Extract<EffectNode, { kind: "filter" }>) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

const MODE_OPTIONS = [
  { value: "hp" as FilterMode, label: "HP" },
  { value: "lp" as FilterMode, label: "LP" },
  { value: "bp" as FilterMode, label: "BP" },
] as const;

function formatFreq(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

export function FilterCard({ node, onChange, onRemove, reorder }: Props) {
  return (
    <EffectCard
      label="FILTER"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      onRemove={onRemove}
      reorder={reorder}
    >
      <div className="flex flex-col gap-3">
        <SegmentedGroup
          label="mode"
          value={node.mode}
          options={MODE_OPTIONS}
          onChange={(v) => onChange({ ...node, mode: v })}
        />
        <div className="flex items-start gap-4 pt-2 border-t border-[color:var(--wb-line-soft)]">
          <Knob
            label="FREQ"
            value={node.freq}
            min={EFFECT_RANGES.filter.freq.min}
            max={EFFECT_RANGES.filter.freq.max}
            defaultValue={EFFECT_RANGES.filter.freq.default}
            step={1}
            log
            format={formatFreq}
            onChange={(v) => onChange({ ...node, freq: v })}
          />
          <Knob
            label="Q"
            value={node.q}
            min={EFFECT_RANGES.filter.q.min}
            max={EFFECT_RANGES.filter.q.max}
            defaultValue={EFFECT_RANGES.filter.q.default}
            step={0.1}
            decimals={2}
            format={(v) => `Q ${v.toFixed(2)}`}
            onChange={(v) => onChange({ ...node, q: v })}
          />
        </div>
      </div>
    </EffectCard>
  );
}
