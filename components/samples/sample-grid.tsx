import type { SampleWithVibes } from "@/lib/db/queries/samples";
import type { SampleUserState } from "@/lib/db/queries/sample-user-data";
import { SampleCard } from "./sample-card";

interface Props {
  samples: SampleWithVibes[];
  userData?: Map<string, SampleUserState>;
}

export function SampleGrid({ samples, userData }: Props) {
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
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-fade">
      {samples.map((sample) => {
        const state = userData?.get(sample.id);
        return (
          <SampleCard
            key={sample.id}
            sample={sample}
            initialFavorite={state?.isFavorite ?? false}
            initialRating={state?.userRating ?? null}
          />
        );
      })}
    </div>
  );
}
