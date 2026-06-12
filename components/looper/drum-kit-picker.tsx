"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Drum, Search, Volume2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BUILTIN_KITS, type KitManifest } from "@/lib/audio/drum-kit-manifest";
import { auditionKit } from "@/lib/audio/kit-audition";
import { cn } from "@/lib/utils";

interface DrumKitPickerProps {
  currentKitId: string;
  onSelect: (kit: KitManifest) => void;
  disabled?: boolean;
  /** Kit roster (e.g. from /api/kits). Falls back to the builtins. */
  kits?: KitManifest[];
}

/**
 * Searchable kit picker. The filter matches name, id, and kind so "synth",
 * "808", or "acoustic" all narrow the list — sized for manifest-scanned or
 * DB-backed rosters, not just the builtins.
 */
export function DrumKitPicker({
  currentKitId,
  onSelect,
  disabled,
  kits = BUILTIN_KITS,
}: DrumKitPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = kits.find((k) => k.id === currentKitId) ?? kits[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return kits;
    return kits.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.id.toLowerCase().includes(q) ||
        k.kind.toLowerCase().includes(q),
    );
  }, [query, kits]);

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
              <div
                key={kit.id}
                role="option"
                aria-selected={kit.id === currentKitId}
                className={cn(
                  "flex items-center gap-1 rounded-sm pr-1 hover:bg-accent",
                  kit.id === currentKitId && "bg-accent",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect(kit);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
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
                <button
                  type="button"
                  aria-label={`preview kit ${kit.name}`}
                  title="preview this kit"
                  onClick={() => void auditionKit(kit).catch(() => {})}
                  className="rounded-sm p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Volume2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
