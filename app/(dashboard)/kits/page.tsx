import { getKits } from "@/lib/db/queries/kits";
import { KitCard } from "@/components/kits/kit-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default async function KitsPage() {
  const kits = await getKits();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kits</h1>
          <p className="text-muted-foreground">
            {kits.length} curated kit presets. Each kit maps instruments to keyboard zones.
          </p>
        </div>
        <Button render={<Link href="/kits/builder" />} variant="outline" className="gap-1.5">
          <Sparkles className="size-4" />
          AI Kit Builder
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((kit) => (
          <KitCard key={kit.id} kit={kit} />
        ))}
      </div>
    </div>
  );
}
