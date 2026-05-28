"use client";

import { Keyboard } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["1", "2", "3", "4"], label: "Select track 1–4" },
  { keys: ["R"], label: "Record (firmware 'l')" },
  { keys: ["M"], label: "Mute active track (firmware 'a')" },
  { keys: ["T"], label: "Tap tempo (firmware 'b')" },
  { keys: ["Space"], label: "All off" },
  { keys: ["?"], label: "Open this cheat sheet" },
];

export function LooperHotkeysHelp({ open, onOpenChange }: Props) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Keyboard shortcuts (press ?)"
          >
            <Keyboard className="size-3" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="rounded border bg-card px-1 py-0 font-mono text-[9px]">?</kbd>
          </button>
        }
      />
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-3" align="end">
        <h3 className="mb-2 text-sm font-medium">Looper shortcuts</h3>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground/90"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
