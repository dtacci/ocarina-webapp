"use client";

import { EffectCard } from "../effect-card";
import { formatTimecode, formatDuration } from "@/lib/sample-editor/format";
import type { EffectNode } from "@/lib/audio/editor-types";

interface Props {
  node: Extract<EffectNode, { kind: "trim" }>;
  onChange: (node: Extract<EffectNode, { kind: "trim" }>) => void;
}

/**
 * Trim is primarily controlled via the waveform region — this card
 * shows the resulting timestamps as readouts. Toggle disables the crop
 * (plays the full duration).
 */
export function TrimCard({ node, onChange }: Props) {
  const duration = Math.max(0, node.endSec - node.startSec);

  return (
    <EffectCard
      label="TRIM"
      enabled={node.enabled}
      onToggle={() => onChange({ ...node, enabled: !node.enabled })}
    >
      <div className="flex flex-col gap-2 workbench-readout text-xs tabular-nums">
        <Row label="in" value={formatTimecode(node.startSec)} />
        <Row label="out" value={formatTimecode(node.endSec)} />
        <Row label="dur" value={formatDuration(duration)} hint />
      </div>
    </EffectCard>
  );
}

function Row({ label, value, hint = false }: { label: string; value: string; hint?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="workbench-label">{label}</span>
      <span
        className="tabular-nums"
        style={{ color: hint ? "var(--ink-500)" : "var(--ink-200)" }}
      >
        {value}
      </span>
    </div>
  );
}
