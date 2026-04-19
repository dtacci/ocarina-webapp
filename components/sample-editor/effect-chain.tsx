"use client";

/**
 * Horizontal signal-chain layout. Renders each enabled/disabled effect card
 * in order, with "→" arrows between them — the pedalboard metaphor.
 *
 * Handles drag-reorder via HTML5 drag events: grip icons on each card are
 * the drag source; `ChainArrow`s between cards + a leading sliver are the
 * drop targets. `insertAt` is a position in the N-length original chain;
 * the reducer's `REORDER_EFFECTS` expects a `to` that's a position in the
 * (N-1) chain after removal of `from`, which we convert on drop.
 */

import { Fragment, useState } from "react";
import type { EffectKind, EffectNode } from "@/lib/audio/editor-types";
import { TrimCard } from "./effect-cards/trim-card";
import { FadeCard } from "./effect-cards/fade-card";
import { FilterCard } from "./effect-cards/filter-card";
import { PitchCard } from "./effect-cards/pitch-card";
import { ReverbCard } from "./effect-cards/reverb-card";
import { GainCard } from "./effect-cards/gain-card";
import { CompressorCard } from "./effect-cards/compressor-card";
import { AddEffectCard } from "./add-effect-card";
import type { ReorderProps } from "./effect-card";

interface Props {
  chain: EffectNode[];
  durationSec: number;
  onNodeChange: (index: number, node: EffectNode) => void;
  onRemove?: (index: number) => void;
  onAdd?: (node: EffectNode) => void;
  onReorder?: (from: number, to: number) => void;
  reverbBusy?: boolean;
}

export function EffectChain({
  chain,
  durationSec,
  onNodeChange,
  onRemove,
  onAdd,
  onReorder,
  reverbBusy,
}: Props) {
  // Trim + fade are singletons as far as the audio engine is concerned
  // (findNode returns the first match). Hide the × when only one remains
  // so users can't silently orphan the chain.
  const trimCount = chain.filter((n) => n.kind === "trim").length;
  const fadeCount = chain.filter((n) => n.kind === "fade").length;
  const chainKinds = new Set<EffectKind>(chain.map((n) => n.kind));

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropInsertAt, setDropInsertAt] = useState<number | null>(null);

  const reorderEnabled = onReorder !== undefined && chain.length > 1;

  function handleDragStart(i: number, e: React.DragEvent<HTMLDivElement>) {
    setDraggingIndex(i);
    e.dataTransfer.effectAllowed = "move";
    // Firefox requires data to be set for a drag to be initiated.
    e.dataTransfer.setData("text/plain", String(i));
  }

  function handleDragEnd() {
    setDraggingIndex(null);
    setDropInsertAt(null);
  }

  function handleSlotDragOver(insertAt: number, e: React.DragEvent<HTMLDivElement>) {
    if (draggingIndex === null) return;
    // No-op: dropping into the same position the item came from.
    if (insertAt === draggingIndex || insertAt === draggingIndex + 1) {
      if (dropInsertAt !== null) setDropInsertAt(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropInsertAt !== insertAt) setDropInsertAt(insertAt);
  }

  function handleSlotDrop(insertAt: number, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (draggingIndex === null || !onReorder) {
      handleDragEnd();
      return;
    }
    const from = draggingIndex;
    // Convert original-chain insertAt → reducer-expected post-removal `to`.
    const to = insertAt > from ? insertAt - 1 : insertAt;
    if (from !== to) onReorder(from, to);
    handleDragEnd();
  }

  function makeReorderProps(i: number): ReorderProps | undefined {
    if (!reorderEnabled) return undefined;
    return {
      onDragStart: (e) => handleDragStart(i, e),
      onDragEnd: handleDragEnd,
      canMoveLeft: i > 0,
      canMoveRight: i < chain.length - 1,
      onMoveLeft: () => onReorder?.(i, i - 1),
      onMoveRight: () => onReorder?.(i, i + 1),
    };
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex items-stretch gap-0 min-w-fit">
        {reorderEnabled && (
          <DropSlot
            insertAt={0}
            isActive={dropInsertAt === 0}
            isLeading
            onDragOver={(e) => handleSlotDragOver(0, e)}
            onDrop={(e) => handleSlotDrop(0, e)}
            onDragLeave={() => setDropInsertAt((v) => (v === 0 ? null : v))}
          />
        )}
        {chain.map((node, i) => {
          const canRemove =
            onRemove !== undefined &&
            !((node.kind === "trim" && trimCount === 1) ||
              (node.kind === "fade" && fadeCount === 1));
          const isDragging = draggingIndex === i;
          return (
            <Fragment key={`${node.kind}-${i}`}>
              <div
                className="flex items-stretch transition-opacity"
                style={{ opacity: isDragging ? 0.4 : 1 }}
              >
                <CardFor
                  node={node}
                  reverbBusy={reverbBusy}
                  onChange={(next) => onNodeChange(i, next)}
                  onRemove={canRemove ? () => onRemove(i) : undefined}
                  reorder={makeReorderProps(i)}
                />
              </div>
              <DropSlot
                insertAt={i + 1}
                isActive={reorderEnabled && dropInsertAt === i + 1}
                onDragOver={(e) => handleSlotDragOver(i + 1, e)}
                onDrop={(e) => handleSlotDrop(i + 1, e)}
                onDragLeave={() => setDropInsertAt((v) => (v === i + 1 ? null : v))}
              />
            </Fragment>
          );
        })}
        {onAdd && (
          <AddEffectCard chainKinds={chainKinds} durationSec={durationSec} onAdd={onAdd} />
        )}
      </div>
    </div>
  );
}

/**
 * Render the chain arrow (→) by default; turn into an amber insertion bar
 * while a drop is pending. Also works as a leading (pre-first-card) sliver
 * with `isLeading`.
 */
function DropSlot({
  insertAt,
  isActive,
  isLeading = false,
  onDragOver,
  onDrop,
  onDragLeave,
}: {
  insertAt: number;
  isActive: boolean;
  isLeading?: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
}) {
  // Hidden from screen readers — drag-reorder has a keyboard equivalent via
  // the grip's Alt+Arrow.
  return (
    <div
      aria-hidden="true"
      data-insert-at={insertAt}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className="relative flex items-center justify-center transition-colors"
      style={{
        width: isLeading ? 8 : undefined,
        minWidth: isLeading ? 8 : 28,
        color: isActive ? "transparent" : "var(--ink-600)",
      }}
    >
      {!isLeading && <span className="workbench-readout text-xs">→</span>}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2"
          style={{
            width: 2,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--wb-amber)",
            boxShadow: "0 0 8px var(--wb-amber-glow)",
            transition: "opacity 120ms ease",
          }}
        />
      )}
    </div>
  );
}

function CardFor({
  node,
  onChange,
  onRemove,
  reorder,
  reverbBusy,
}: {
  node: EffectNode;
  onChange: (n: EffectNode) => void;
  onRemove?: () => void;
  reorder?: ReorderProps;
  reverbBusy?: boolean;
}) {
  switch (node.kind) {
    case "trim":
      return <TrimCard node={node} onChange={onChange} onRemove={onRemove} reorder={reorder} />;
    case "fade":
      return <FadeCard node={node} onChange={onChange} onRemove={onRemove} reorder={reorder} />;
    case "filter":
      return <FilterCard node={node} onChange={onChange} onRemove={onRemove} reorder={reorder} />;
    case "pitch":
      return <PitchCard node={node} onChange={onChange} onRemove={onRemove} reorder={reorder} />;
    case "reverb":
      return (
        <ReverbCard
          node={node}
          onChange={onChange}
          onRemove={onRemove}
          reorder={reorder}
          busy={reverbBusy}
        />
      );
    case "gain":
      return <GainCard node={node} onChange={onChange} onRemove={onRemove} reorder={reorder} />;
    case "compressor":
      return (
        <CompressorCard
          node={node}
          onChange={onChange}
          onRemove={onRemove}
          reorder={reorder}
        />
      );
  }
}
