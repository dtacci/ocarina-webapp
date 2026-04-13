"use client";

/**
 * Horizontal signal-chain layout. Renders each enabled/disabled effect card
 * in order, with "→" arrows between them — the pedalboard metaphor.
 *
 * Phase 4 scope: renders cards, routes SET_EFFECT dispatches via onNodeChange.
 * Phase 5 adds playback + "+ ADD" menu + drag reorder.
 */

import type { EffectNode } from "@/lib/audio/editor-types";
import { TrimCard } from "./effect-cards/trim-card";
import { FadeCard } from "./effect-cards/fade-card";
import { FilterCard } from "./effect-cards/filter-card";
import { PitchCard } from "./effect-cards/pitch-card";
import { ReverbCard } from "./effect-cards/reverb-card";
import { GainCard } from "./effect-cards/gain-card";

interface Props {
  chain: EffectNode[];
  onNodeChange: (index: number, node: EffectNode) => void;
  reverbBusy?: boolean;
}

export function EffectChain({ chain, onNodeChange, reverbBusy }: Props) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex items-stretch gap-0 min-w-fit">
        {chain.map((node, i) => (
          <div key={`${node.kind}-${i}`} className="flex items-stretch">
            <CardFor
              node={node}
              reverbBusy={reverbBusy}
              onChange={(next) => onNodeChange(i, next)}
            />
            {i < chain.length - 1 && <ChainArrow />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChainArrow() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center px-2 workbench-readout text-xs"
      style={{ color: "var(--ink-600)" }}
    >
      →
    </div>
  );
}

function CardFor({
  node,
  onChange,
  reverbBusy,
}: {
  node: EffectNode;
  onChange: (n: EffectNode) => void;
  reverbBusy?: boolean;
}) {
  switch (node.kind) {
    case "trim":
      return <TrimCard node={node} onChange={onChange} />;
    case "fade":
      return <FadeCard node={node} onChange={onChange} />;
    case "filter":
      return <FilterCard node={node} onChange={onChange} />;
    case "pitch":
      return <PitchCard node={node} onChange={onChange} />;
    case "reverb":
      return <ReverbCard node={node} onChange={onChange} busy={reverbBusy} />;
    case "gain":
      return <GainCard node={node} onChange={onChange} />;
  }
}
