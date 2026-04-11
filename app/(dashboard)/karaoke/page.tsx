import { Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function KaraokePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Karaoke</h1>
          <p className="text-muted-foreground">
            Browse 888 songs, filter by genre and decade, and sing along.
          </p>
        </div>
        <Badge variant="outline">v0.2</Badge>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Mic className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Karaoke browser coming in v0.2</p>
          <p className="text-xs text-muted-foreground">
            Song catalog, favorites, and lyrics display (v0.3)
          </p>
        </div>
      </div>
    </div>
  );
}
