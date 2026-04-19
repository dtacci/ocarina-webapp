"use client";

/**
 * Contents of the `+ ADD` overlay — grouped list of effect kinds a user can
 * add to the chain. Trim and fade are singletons (the audio engine reads
 * the *first* match, so duplicates would silently no-op); we hide those rows
 * when one already exists in the chain.
 */

import type { EffectKind } from "@/lib/audio/editor-types";

interface Props {
  /** Kinds that currently appear in the chain — used to hide singleton options. */
  chainKinds: Set<EffectKind>;
  onPick: (kind: EffectKind) => void;
}

interface Row {
  kind: EffectKind;
  label: string;
  hint: string;
}

interface Group {
  title: string;
  rows: Row[];
}

const GROUPS: Group[] = [
  {
    title: "DYNAMICS",
    rows: [{ kind: "compressor", label: "compressor", hint: "threshold · ratio · attack · release" }],
  },
  {
    title: "EQ",
    rows: [{ kind: "filter", label: "filter", hint: "hp / lp / bp with q" }],
  },
  {
    title: "PITCH",
    rows: [{ kind: "pitch", label: "pitch", hint: "± 24 semitones" }],
  },
  {
    title: "TIME",
    rows: [{ kind: "reverb", label: "reverb", hint: "decay + wet (async ir)" }],
  },
  {
    title: "LEVEL",
    rows: [
      { kind: "gain", label: "gain", hint: "± 24 db trim" },
      { kind: "fade", label: "fade", hint: "in / out curves · one per chain" },
    ],
  },
  {
    title: "STRUCTURE",
    rows: [{ kind: "trim", label: "trim", hint: "region boundaries · one per chain" }],
  },
];

const SINGLETON_KINDS: ReadonlySet<EffectKind> = new Set(["trim", "fade"]);

export function AddEffectMenu({ chainKinds, onPick }: Props) {
  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-[color:var(--wb-line-soft)]">
        <div className="workbench-label">add effect</div>
      </div>

      <div className="p-2 max-h-[70vh] overflow-y-auto">
        {GROUPS.map((group) => {
          const visibleRows = group.rows.filter(
            (r) => !(SINGLETON_KINDS.has(r.kind) && chainKinds.has(r.kind)),
          );
          if (visibleRows.length === 0) return null;
          return (
            <div key={group.title} className="mb-3 last:mb-0">
              <div className="workbench-label px-2 py-1 text-[9px]">{group.title}</div>
              <ul className="flex flex-col">
                {visibleRows.map((row) => (
                  <li key={row.kind}>
                    <button
                      type="button"
                      onClick={() => onPick(row.kind)}
                      className="w-full flex items-baseline gap-3 px-2 py-1.5 text-left hover:bg-[color:var(--ink-700)] transition-colors group"
                    >
                      <span className="workbench-readout text-xs text-[color:var(--ink-300)] group-hover:text-[color:var(--wb-amber)] transition-colors lowercase">
                        · {row.label}
                      </span>
                      <span className="text-[10px] text-[color:var(--ink-500)] lowercase tabular-nums">
                        {row.hint}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
