import { Music } from "lucide-react";

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sample Library</h1>
        <p className="text-muted-foreground">
          Browse 4,886 orchestral samples. Filter by family, vibes, and attributes.
        </p>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Music className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Sample browser coming soon</p>
          <p className="text-xs text-muted-foreground">
            Waveform cards, faceted filtering, and AI-powered search
          </p>
        </div>
      </div>
    </div>
  );
}
