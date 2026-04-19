"use client";

/**
 * Trailing card in the signal chain that opens the `+ ADD` overlay.
 *
 * Matches effect-card min-width so the chain lays out cleanly, but uses a
 * dashed border + dim amber on hover to signal "this is a slot, not an
 * effect".
 */

import { useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import type { EffectKind, EffectNode } from "@/lib/audio/editor-types";
import { makeDefaultNode } from "@/lib/audio/editor-types";
import { Overlay, type OverlayHandle } from "./primitives/overlay";
import { AddEffectMenu } from "./add-effect-menu";

interface Props {
  chainKinds: Set<EffectKind>;
  durationSec: number;
  onAdd: (node: EffectNode) => void;
}

export function AddEffectCard({ chainKinds, durationSec, onAdd }: Props) {
  const overlayRef = useRef<OverlayHandle>(null);

  const handlePick = useCallback(
    (kind: EffectKind) => {
      onAdd(makeDefaultNode(kind, durationSec));
      overlayRef.current?.close();
    },
    [onAdd, durationSec],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => overlayRef.current?.open()}
        aria-label="add effect"
        className="flex flex-col items-center justify-center border border-dashed border-[color:var(--wb-line)] text-[color:var(--ink-500)] hover:border-[color:var(--wb-amber-dim)] hover:text-[color:var(--wb-amber)] transition-colors cursor-pointer"
        style={{
          minWidth: 120,
          boxShadow: "none",
        }}
      >
        <Plus className="size-4 mb-1.5" />
        <span className="workbench-label">+ add</span>
      </button>

      <Overlay ref={overlayRef} width={360}>
        <AddEffectMenu chainKinds={chainKinds} onPick={handlePick} />
      </Overlay>
    </>
  );
}
