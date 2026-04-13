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
import { ChevronDown } from "lucide-react";

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
}

export function EffectCard({
  label,
  enabled,
  onToggle,
  children,
  advanced,
  busy = false,
  minWidth = 180,
}: EffectCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="relative flex flex-col bg-[color:var(--ink-800)] border border-[color:var(--wb-line)]"
      style={{
        minWidth,
        borderLeftColor: enabled ? "var(--wb-amber)" : "var(--wb-line)",
        borderLeftWidth: 2,
      }}
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--wb-line-soft)]">
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
        {advanced && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "collapse advanced" : "expand advanced"}
            aria-expanded={expanded}
            className="ml-auto text-[color:var(--ink-500)] hover:text-[color:var(--ink-300)] transition-colors"
          >
            <ChevronDown
              className="size-3.5 transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        )}
      </header>
      <div className="p-3">{children}</div>
      {advanced && expanded && (
        <div className="border-t border-[color:var(--wb-line-soft)] p-3">{advanced}</div>
      )}
    </div>
  );
}
