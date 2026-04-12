"use client";

import { ChevronDown, Drum } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BUILTIN_KITS, type KitManifest } from "@/lib/audio/drum-kit-manifest";
import { cn } from "@/lib/utils";

interface DrumKitPickerProps {
  currentKitId: string;
  onSelect: (kit: KitManifest) => void;
  disabled?: boolean;
}

export function DrumKitPicker({ currentKitId, onSelect, disabled }: DrumKitPickerProps) {
  const current = BUILTIN_KITS.find((k) => k.id === currentKitId) ?? BUILTIN_KITS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
            <Drum className="size-3.5" />
            <span className="text-xs">{current.name}</span>
            <ChevronDown className="size-3" />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        {BUILTIN_KITS.map((kit) => (
          <DropdownMenuItem
            key={kit.id}
            onClick={() => onSelect(kit)}
            className={cn("gap-2", kit.id === currentKitId && "bg-accent")}
          >
            <span className="flex-1">{kit.name}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {kit.kind}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
