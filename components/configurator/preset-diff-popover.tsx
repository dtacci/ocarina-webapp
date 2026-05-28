"use client";

import { useMemo, useState } from "react";
import { GitCompare } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ButtonState, PresetIndex } from "@/lib/ocarina-api";

interface Props {
  builtin: PresetIndex;
  user: PresetIndex;
  /** Current button mapping — surfaced as a synthetic "Current state" option. */
  currentButtons: ButtonState[];
  disabled?: boolean;
}

type Side = "a" | "b";

const CURRENT_KEY = "__current__";

export function PresetDiffPopover({
  builtin,
  user,
  currentButtons,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [aKey, setAKey] = useState<string>(CURRENT_KEY);
  const [bKey, setBKey] = useState<string>(() => {
    const firstUser = Object.keys(user)[0];
    const firstBuiltin = Object.keys(builtin)[0];
    return firstUser ?? firstBuiltin ?? CURRENT_KEY;
  });

  const currentNotes = useMemo(
    () => currentButtons.map((b) => b.note_name ?? b.default_name),
    [currentButtons]
  );

  const notesFor = (key: string): string[] => {
    if (key === CURRENT_KEY) return currentNotes;
    return builtin[key]?.notes ?? user[key]?.notes ?? [];
  };

  const aNotes = notesFor(aKey);
  const bNotes = notesFor(bKey);

  const diffCount = useMemo(() => {
    let n = 0;
    const len = Math.max(aNotes.length, bNotes.length);
    for (let i = 0; i < len; i++) {
      if (aNotes[i] !== bNotes[i]) n++;
    }
    return n;
  }, [aNotes, bNotes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            title="Compare two presets"
          >
            <GitCompare className="size-3" />
            Compare
          </button>
        }
      />
      <PopoverContent
        className="w-[min(36rem,calc(100vw-2rem))] p-3"
        align="end"
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Compare presets</h3>
            <p className="text-[11px] text-muted-foreground">
              Pick A and B — differences are highlighted.
            </p>
          </div>
          <span
            className={`font-mono text-[11px] tabular-nums ${
              diffCount > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {diffCount === 0 ? "identical" : `${diffCount} diff${diffCount === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SidePanel
            label="A"
            value={aKey}
            onChange={setAKey}
            builtin={builtin}
            user={user}
            notes={aNotes}
            otherNotes={bNotes}
            side="a"
          />
          <SidePanel
            label="B"
            value={bKey}
            onChange={setBKey}
            builtin={builtin}
            user={user}
            notes={bNotes}
            otherNotes={aNotes}
            side="b"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SidePanel({
  label,
  value,
  onChange,
  builtin,
  user,
  notes,
  otherNotes,
  side,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  builtin: PresetIndex;
  user: PresetIndex;
  notes: string[];
  otherNotes: string[];
  side: Side;
}) {
  const accent = side === "a" ? "text-sky-300" : "text-violet-300";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className={`font-mono text-[10px] uppercase tracking-wider ${accent}`}>
          {label}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value={CURRENT_KEY}>Current state</option>
          {Object.keys(builtin).length > 0 && (
            <optgroup label="Built-in">
              {Object.keys(builtin)
                .sort()
                .map((n) => (
                  <option key={`b-${n}`} value={n}>{n}</option>
                ))}
            </optgroup>
          )}
          {Object.keys(user).length > 0 && (
            <optgroup label="Your presets">
              {Object.keys(user)
                .sort()
                .map((n) => (
                  <option key={`u-${n}`} value={n}>{n}</option>
                ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {Array.from({ length: 12 }).map((_, i) => {
          const note = notes[i] ?? "—";
          const other = otherNotes[i] ?? "—";
          const differs = note !== other;
          return (
            <div
              key={i}
              className={[
                "flex flex-col items-center rounded-sm border px-0.5 py-1 font-mono text-[10px]",
                differs
                  ? side === "a"
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                    : "border-violet-500/50 bg-violet-500/10 text-violet-200"
                  : "border-border/60 bg-card/50 text-foreground/70",
              ].join(" ")}
              title={`Button ${i + 1}: ${note}${differs ? ` (other: ${other})` : ""}`}
            >
              <span className="text-[8px] text-muted-foreground/70">{i + 1}</span>
              <span>{note}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
