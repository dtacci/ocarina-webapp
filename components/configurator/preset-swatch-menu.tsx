"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, User } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PresetIndex } from "@/lib/ocarina-api";

interface Props {
  label: string;
  presets: PresetIndex;
  source: "builtin" | "user";
  disabled?: boolean;
  onApply: (name: string) => void;
  /** Optional trailing action — e.g. delete for user presets. */
  trailingAction?: (name: string) => React.ReactNode;
}

/**
 * Preset chooser that previews the 12-button layout for each option, so the
 * user can compare mappings without applying first.
 */
export function PresetSwatchMenu({
  label,
  presets,
  source,
  disabled,
  onApply,
  trailingAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const names = Object.keys(presets).sort();

  const Icon = source === "user" ? User : Sparkles;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled || names.length === 0}
            className="flex w-full items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-sm hover:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="size-3" />
              {names.length === 0 ? "(none)" : label}
            </span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-2">
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {names.map((name) => {
            const preset = presets[name];
            return (
              <div
                key={name}
                className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/30"
              >
                <button
                  type="button"
                  onClick={() => {
                    onApply(name);
                    setOpen(false);
                  }}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    <NoteSwatch notes={preset.notes} />
                  </div>
                </button>
                {trailingAction && (
                  <div className="opacity-0 transition-opacity group-hover:opacity-100">
                    {trailingAction(name)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NoteSwatch({ notes }: { notes: string[] }) {
  return (
    <div className="mt-1 flex gap-[2px]">
      {notes.slice(0, 12).map((note, i) => (
        <div
          key={i}
          className="flex h-5 min-w-0 flex-1 items-center justify-center rounded-sm border border-border/60 bg-card/60 px-0.5 font-mono text-[9px] text-foreground/80"
          title={`Button ${i + 1}: ${note}`}
        >
          {note}
        </div>
      ))}
    </div>
  );
}
