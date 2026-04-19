"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "reverb" }>;
  onChange: (node: Extract<EffectNode, { kind: "reverb" }>) => void;
  /** True while Tone.Reverb.ready is pending (IR regeneration). */
  busy?: boolean;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

export function ReverbCard({ node, onChange, busy = false, onRemove, reorder }: Props) {
  return (
    <EffectCard
      label="REVERB"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      busy={busy}
      onRemove={onRemove}
      reorder={reorder}
    >
      <div className="flex items-start gap-4">
        <Knob
          label="DECAY"
          value={node.decaySec}
          min={EFFECT_RANGES.reverb.decaySec.min}
          max={EFFECT_RANGES.reverb.decaySec.max}
          defaultValue={EFFECT_RANGES.reverb.decaySec.default}
          step={0.1}
          decimals={2}
          unit="s"
          onChange={(v) => onChange({ ...node, decaySec: v })}
        />
        <Knob
          label="WET"
          value={node.wet}
          min={EFFECT_RANGES.reverb.wet.min}
          max={EFFECT_RANGES.reverb.wet.max}
          defaultValue={EFFECT_RANGES.reverb.wet.default}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)} %`}
          onChange={(v) => onChange({ ...node, wet: v })}
        />
      </div>
    </EffectCard>
  );
}
