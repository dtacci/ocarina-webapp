"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const CHROMATIC_NOTES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

interface Props {
  current: string | null;
  defaultName: string;
  /** Called with a note name to assign, or "default" to clear the override. */
  onAssign: (value: string) => void | Promise<void>;
  children: React.ReactNode;
}

/**
 * 12-note chromatic picker for a single button. The Pi accepts a note name
 * ("C".."B"), a numeric index 0..11, or the sentinel "default" to clear an
 * override. We only emit names + "default" — keeps the wire format readable.
 */
export function NotePickerPopover({
  current,
  defaultName,
  onAssign,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pick(value: string) {
    setBusy(true);
    try {
      await onAssign(value);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Assign note</p>
            <p className="text-xs text-muted-foreground">
              Live — changes apply on the Ocarina immediately.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {CHROMATIC_NOTES.map((n) => {
              const active = current === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  onClick={() => pick(n)}
                  className={[
                    "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/60 bg-primary/20 text-primary-foreground"
                      : "border-border bg-card hover:border-foreground/40",
                    busy ? "cursor-wait opacity-60" : "",
                  ].join(" ")}
                >
                  {n}
                  {active && (
                    <Check className="ml-1 inline size-3" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => pick("default")}
            className={[
              "flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground",
              busy ? "cursor-wait opacity-60" : "",
            ].join(" ")}
          >
            <RotateCcw className="size-3" />
            Reset to default ({defaultName})
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
