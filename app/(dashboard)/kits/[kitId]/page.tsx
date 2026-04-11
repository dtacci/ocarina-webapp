import { notFound } from "next/navigation";
import { getKit } from "@/lib/db/queries/kits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const slotColors = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500", "bg-pink-500", "bg-cyan-500",
];

interface Props {
  params: Promise<{ kitId: string }>;
}

export default async function KitDetailPage({ params }: Props) {
  const { kitId } = await params;
  const kit = await getKit(kitId);
  if (!kit) notFound();

  const slotEntries = Object.entries(kit.slots);

  return (
    <div className="space-y-6 max-w-2xl">
      <Button render={<Link href="/kits" />} variant="ghost" size="sm" className="gap-1.5 -ml-2">
        <ArrowLeft className="size-4" />
        All kits
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{kit.name}</h1>
        {kit.description && (
          <p className="text-muted-foreground">{kit.description}</p>
        )}
      </div>

      {/* Triggers */}
      <div>
        <h2 className="text-sm font-medium uppercase text-muted-foreground tracking-wider mb-2">
          Voice Triggers
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {kit.triggers.map((t) => (
            <Badge key={t} variant="secondary">{t}</Badge>
          ))}
        </div>
      </div>

      {/* Vibes */}
      <div>
        <h2 className="text-sm font-medium uppercase text-muted-foreground tracking-wider mb-2">
          Vibes
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {kit.vibes.map((v) => (
            <Badge key={v} variant="outline">{v}</Badge>
          ))}
        </div>
      </div>

      {/* Slots */}
      <div>
        <h2 className="text-sm font-medium uppercase text-muted-foreground tracking-wider mb-3">
          Instrument Slots
        </h2>
        <div className="space-y-3">
          {slotEntries.map(([name, slot], i) => (
            <div
              key={name}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <div className={`mt-0.5 size-3 rounded-full shrink-0 ${slotColors[i % slotColors.length]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium capitalize">{name}</h3>
                  {slot.optional && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">optional</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {slot.family && <span>Family: <strong>{slot.family}</strong></span>}
                </div>
                {slot.vibes && slot.vibes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {slot.vibes.map((v) => (
                      <Badge key={v} variant="outline" className="text-[10px] px-1 py-0">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {/* Keyboard mapping */}
              {kit.keyboard_map && Object.entries(kit.keyboard_map).find(([, v]) => v === name) && (
                <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                  {Object.entries(kit.keyboard_map).find(([, v]) => v === name)?.[0]}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
