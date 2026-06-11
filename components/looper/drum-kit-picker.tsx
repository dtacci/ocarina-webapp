"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Drum, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BUILTIN_KITS, type KitManifest } from "@/lib/audio/drum-kit-manifest";
import { cn } from "@/lib/utils";

interface DrumKitPickerProps {
  currentKitId: string;
  onSelect: (kit: KitManifest) => void;
  disabled?: boolean;
}

/**
 * Searchable kit picker. The filter matches name, id, and kind so "synth",
 * "808", or "acoustic" all narrow the list — sized for the day kits come
 * from the DB instead of BUILTIN_KITS.
 */
export function DrumKitPicker({ currentKitId, onSelect, disabled }: DrumKitPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = BUILTIN_KITS.find((k) => k.id === currentKitId) ?? BUILTIN_KITS[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BUILTIN_KITS;
    return BUILTIN_KITS.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.id.toLowerCase().includes(q) ||
        k.kind.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-2"
            aria-label="select drum kit"
          >
            <Drum className="size-3.5" />
            <span className="text-xs">{current.name}</span>
            <ChevronDown className="size-3" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-60 p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search kits…"
            aria-label="search kits"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto" role="listbox" aria-label="drum kits">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              no kits match &ldquo;{query}&rdquo;
            </p>
          ) : (
            filtered.map((kit) => (
              <button
                key={kit.id}
                type="button"
                role="option"
                aria-selected={kit.id === currentKitId}
                onClick={() => {
                  onSelect(kit);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  kit.id === currentKitId && "bg-accent",
                )}
              >
                <Check
                  className={cn(
                    "size-3.5 shrink-0",
                    kit.id === currentKitId ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="flex-1 truncate">{kit.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {kit.kind}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
