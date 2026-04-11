import { Layers } from "lucide-react";

export default function KitsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kits</h1>
        <p className="text-muted-foreground">
          Browse 12 curated kit presets and build your own with AI assistance.
        </p>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Layers className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Kit browser coming soon</p>
          <p className="text-xs text-muted-foreground">
            View slot definitions, play samples, and use AI Kit Builder
          </p>
        </div>
      </div>
    </div>
  );
}
