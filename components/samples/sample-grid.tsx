import type { SampleWithVibes } from "@/lib/db/queries/samples";
import { SampleCard } from "./sample-card";

export function SampleGrid({ samples }: { samples: SampleWithVibes[] }) {
  if (samples.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          No samples match your filters. Try removing some filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {samples.map((sample) => (
        <SampleCard key={sample.id} sample={sample} />
      ))}
    </div>
  );
}
