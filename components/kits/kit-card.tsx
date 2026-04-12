import Link from "next/link";
import type { KitRow } from "@/lib/db/queries/kits";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";

const slotColors = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500", "bg-pink-500", "bg-cyan-500",
];

export function KitCard({ kit }: { kit: KitRow }) {
  const slotEntries = Object.entries(kit.slots);

  return (
    <Link
      href={`/kits/${kit.id}`}
      className="group block rounded-xl border border-border/50 bg-card/80 p-4 transition-all hover:border-primary/30 hover:bg-card hover-lift"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Layers className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{kit.name}</h3>
          {kit.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {kit.description}
            </p>
          )}
        </div>
      </div>

      {/* Slots visualization */}
      <div className="mb-3 flex gap-1">
        {slotEntries.map(([name, slot], i) => (
          <div
            key={name}
            className={`h-2 flex-1 rounded-full ${slotColors[i % slotColors.length]} ${
              slot.optional ? "opacity-40" : "opacity-70"
            } group-hover:opacity-100 transition-opacity`}
            title={`${name}: ${slot.family || "any"}`}
          />
        ))}
      </div>

      {/* Slot list */}
      <div className="space-y-1 mb-3">
        {slotEntries.map(([name, slot]) => (
          <div key={name} className="flex items-center justify-between text-xs">
            <span className="capitalize font-medium">{name}</span>
            <span className="text-muted-foreground">
              {slot.family || "any"}{slot.optional ? " (opt)" : ""}
            </span>
          </div>
        ))}
      </div>

      {/* Vibes */}
      <div className="flex flex-wrap gap-1">
        {kit.vibes.slice(0, 4).map((v) => (
          <Badge key={v} variant="outline" className="text-[10px] px-1 py-0">
            {v}
          </Badge>
        ))}
      </div>
    </Link>
  );
}
