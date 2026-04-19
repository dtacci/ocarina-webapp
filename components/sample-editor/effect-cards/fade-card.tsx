"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { SegmentedGroup } from "../primitives/segmented-group";
import { EFFECT_RANGES, type EffectNode, type FadeCurve } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "fade" }>;
  onChange: (node: Extract<EffectNode, { kind: "fade" }>) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

const CURVE_OPTIONS = [
  { value: "linear" as FadeCurve, label: "LIN" },
  { value: "exp" as FadeCurve, label: "EXP" },
] as const;

export function FadeCard({ node, onChange, onRemove, reorder }: Props) {
  return (
    <EffectCard
      label="FADE"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      onRemove={onRemove}
      reorder={reorder}
    >
      <div className="flex items-start gap-4">
        <Knob
          label="IN"
          value={node.inMs}
          min={EFFECT_RANGES.fade.inMs.min}
          max={EFFECT_RANGES.fade.inMs.max}
          defaultValue={EFFECT_RANGES.fade.inMs.default}
          step={10}
          unit="ms"
          decimals={0}
          onChange={(v) => onChange({ ...node, inMs: v })}
        />
        <Knob
          label="OUT"
          value={node.outMs}
          min={EFFECT_RANGES.fade.outMs.min}
          max={EFFECT_RANGES.fade.outMs.max}
          defaultValue={EFFECT_RANGES.fade.outMs.default}
          step={10}
          unit="ms"
          decimals={0}
          onChange={(v) => onChange({ ...node, outMs: v })}
        />
      </div>
      <div className="mt-3 pt-3 border-t border-[color:var(--wb-line-soft)]">
        <SegmentedGroup
          label="curve"
          value={node.curve}
          options={CURVE_OPTIONS}
          onChange={(v) => onChange({ ...node, curve: v })}
        />
      </div>
    </EffectCard>
  );
}
