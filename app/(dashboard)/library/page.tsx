import { Suspense } from "react";
import { getSamples, getFamilyCounts, type SampleFilters } from "@/lib/db/queries/samples";
import { FilterSidebar } from "@/components/samples/filter-sidebar";
import { SampleGrid } from "@/components/samples/sample-grid";
import { Pagination } from "@/components/samples/pagination";
import { AISearch } from "@/components/samples/ai-search";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseFilters(raw: Record<string, string | string[] | undefined>): SampleFilters {
  const str = (key: string) => {
    const v = raw[key];
    return typeof v === "string" ? v : undefined;
  };
  const num = (key: string) => {
    const v = str(key);
    return v ? parseInt(v, 10) : undefined;
  };

  return {
    family: str("family"),
    category: str("category"),
    vibes: str("vibes")?.split(",").filter(Boolean),
    brightnessMin: num("bMin"),
    brightnessMax: num("bMax"),
    warmthMin: num("wMin"),
    warmthMax: num("wMax"),
    attackMin: num("aMin"),
    attackMax: num("aMax"),
    sustainMin: num("sMin"),
    sustainMax: num("sMax"),
    search: str("q"),
    page: num("page"),
  };
}

async function LibraryContent({ filters }: { filters: SampleFilters }) {
  const [result, familyCounts] = await Promise.all([
    getSamples(filters),
    getFamilyCounts(),
  ]);

  return (
    <div className="flex gap-6">
      <FilterSidebar familyCounts={familyCounts} />
      <div className="flex-1 space-y-4">
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} />
        <SampleGrid samples={result.samples} />
        {result.totalPages > 1 && (
          <Pagination page={result.page} totalPages={result.totalPages} total={result.total} />
        )}
      </div>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="flex gap-6">
      <div className="w-56 shrink-0 space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
      <div className="flex-1">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function LibraryPage({ searchParams }: Props) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sample Library</h1>
        <p className="text-muted-foreground">
          Browse 3,859 orchestral samples. Filter by family, vibes, and attributes.
        </p>
      </div>
      <AISearch />
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryContent filters={filters} />
      </Suspense>
    </div>
  );
}
