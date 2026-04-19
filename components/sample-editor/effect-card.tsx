"use client";

/**
 * Base card used by every effect in the signal chain.
 *
 * Anatomy:
 *   ┌─ LED dot ─ EFFECT NAME ─ chevron ─┐
 *   │                                    │
 *   │  (child knobs/sliders/segments)    │
 *   │                                    │
 *   └────────────────────────────────────┘
 *
 * Enabled cards get an amber left-border accent. Clicking the LED toggles bypass.
 * The chevron is optional — shown only when `advanced` is provided.
 */

import { useState } from "react";
import { ChevronDown, GripVertical, X } from "lucide-react";

/**
 * Drag + keyboard-reorder affordance. When provided, the card grows a
 * grip icon on the left of the header that acts as the HTML5 drag source
 * and handles Alt+Arrow reordering for keyboard users.
 */
export interface ReorderProps {
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

export interface EffectCardProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  advanced?: React.ReactNode;
  /** Busy state (e.g. reverb IR loading). Dims the LED + shows ellipsis. */
  busy?: boolean;
  /** Minimum width so cards align in a row. Default 180. */
  minWidth?: number;
  /**
   * When provided, shows a hover-revealed × button that removes this card
   * from the chain. Omit for non-removable cards (e.g. the sole trim/fade).
   */
  onRemove?: () => void;
  /** When provided, renders a drag grip + wires Alt+Arrow keyboard reorder. */
  reorder?: ReorderProps;
}

export function EffectCard({
  label,
  enabled,
  onToggle,
  children,
  advanced,
  busy = false,
  minWidth = 180,
  onRemove,
  reorder,
}: EffectCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleGripKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!reorder || !e.altKey) return;
    if (e.key === "ArrowLeft" && reorder.canMoveLeft) {
      e.preventDefault();
      reorder.onMoveLeft();
    } else if (e.key === "ArrowRight" && reorder.canMoveRight) {
      e.preventDefault();
      reorder.onMoveRight();
    }
  };

  return (
    <div
      className="group relative flex flex-col bg-[color:var(--ink-800)] border border-[color:var(--wb-line)]"
      style={{
        minWidth,
        borderLeftColor: enabled ? "var(--wb-amber)" : "var(--wb-line)",
        borderLeftWidth: 2,
      }}
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--wb-line-soft)]">
        {reorder && (
          <div
            draggable
            onDragStart={reorder.onDragStart}
            onDragEnd={reorder.onDragEnd}
            onKeyDown={handleGripKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`reorder ${label}`}
            aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
            className="cursor-grab active:cursor-grabbing text-[color:var(--ink-500)] hover:text-[color:var(--wb-amber-dim)] focus:text-[color:var(--wb-amber)] focus:outline-none transition-colors -ml-1"
            style={{ touchAction: "none" }}
          >
            <GripVertical className="size-3.5" />
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={enabled ? `bypass ${label}` : `enable ${label}`}
          aria-pressed={enabled}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span
            className="workbench-led"
            data-on={enabled}
            style={busy ? { opacity: 0.5 } : undefined}
          />
          <span className="workbench-label">{label}</span>
        </button>
        {busy && (
          <span className="workbench-readout text-[10px] text-[color:var(--wb-amber-dim)]">…</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {advanced && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "collapse advanced" : "expand advanced"}
              aria-expanded={expanded}
              className="text-[color:var(--ink-500)] hover:text-[color:var(--ink-300)] transition-colors"
            >
              <ChevronDown
                className="size-3.5 transition-transform"
                style={{ transform: expanded ? "rotate(180deg)" : undefined }}
              />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`remove ${label}`}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-[color:var(--ink-500)] hover:text-[color:var(--wb-oxide)] transition-opacity"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </header>
      <div className="p-3">{children}</div>
      {advanced && expanded && (
        <div className="border-t border-[color:var(--wb-line-soft)] p-3">{advanced}</div>
      )}
    </div>
  );
}
