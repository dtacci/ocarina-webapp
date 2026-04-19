"use client";

import { EffectCard, type ReorderProps } from "../effect-card";
import { Knob } from "../primitives/knob";
import { EFFECT_RANGES, type EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "compressor" }>;
  onChange: (node: Extract<EffectNode, { kind: "compressor" }>) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
}

const R = EFFECT_RANGES.compressor;

export function CompressorCard({ node, onChange, onRemove, reorder }: Props) {
  return (
    <EffectCard
      label="COMPRESSOR"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
      onRemove={onRemove}
      reorder={reorder}
      advanced={
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <Knob
              label="ATTACK"
              value={node.attack * 1000}
              min={R.attack.min * 1000}
              max={R.attack.max * 1000}
              defaultValue={R.attack.default * 1000}
              step={0.1}
              decimals={1}
              unit="ms"
              log
              onChange={(v) => onChange({ ...node, attack: v / 1000 })}
            />
            <Knob
              label="RELEASE"
              value={node.release * 1000}
              min={R.release.min * 1000}
              max={R.release.max * 1000}
              defaultValue={R.release.default * 1000}
              step={1}
              decimals={0}
              unit="ms"
              log
              onChange={(v) => onChange({ ...node, release: v / 1000 })}
            />
          </div>
          <div className="flex items-start gap-4 pt-2 border-t border-[color:var(--wb-line-soft)]">
            <Knob
              label="KNEE"
              value={node.knee}
              min={R.knee.min}
              max={R.knee.max}
              defaultValue={R.knee.default}
              step={1}
              decimals={0}
              unit="dB"
              onChange={(v) => onChange({ ...node, knee: v })}
            />
            <Knob
              label="MAKEUP"
              value={node.makeup}
              min={R.makeup.min}
              max={R.makeup.max}
              defaultValue={R.makeup.default}
              step={0.5}
              decimals={1}
              unit="dB"
              showSign
              onChange={(v) => onChange({ ...node, makeup: v })}
            />
          </div>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <Knob
          label="THRESHOLD"
          value={node.threshold}
          min={R.threshold.min}
          max={R.threshold.max}
          defaultValue={R.threshold.default}
          step={1}
          decimals={0}
          unit="dB"
          showSign
          onChange={(v) => onChange({ ...node, threshold: v })}
        />
        <Knob
          label="RATIO"
          value={node.ratio}
          min={R.ratio.min}
          max={R.ratio.max}
          defaultValue={R.ratio.default}
          step={0.1}
          format={(v) => `${v.toFixed(1)}:1`}
          onChange={(v) => onChange({ ...node, ratio: v })}
        />
      </div>
    </EffectCard>
  );
}
