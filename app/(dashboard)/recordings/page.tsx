import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getRecordings, type SortOption } from "@/lib/db/queries/recordings";
import { UploadButton } from "@/components/recordings/upload-button";
import { RecordingsClient } from "./page-client";

const PAGE_SIZE = 12;

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const { q = "", page: pageStr = "1", sort: sortParam = "date-desc" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const VALID_SORTS: SortOption[] = ["date-desc", "date-asc", "duration-desc", "bpm-desc"];
  const sort: SortOption = VALID_SORTS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : "date-desc";

  // Get userId so the client can subscribe to Realtime recording inserts
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch one extra to determine if there's a next page
  const recordings = await getRecordings({ limit: PAGE_SIZE + 1, page, query: q, sort });
  const hasMore = recordings.length > PAGE_SIZE;
  const pageRecordings = recordings.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recordings</h1>
          <p className="text-muted-foreground">
            Your recording library. Auto-synced from your Ocarina.
          </p>
        </div>
        <UploadButton />
      </div>

      <Suspense fallback={null}>
        <RecordingsClient
          initialRecordings={pageRecordings}
          currentPage={page}
          hasMore={hasMore}
          query={q}
          userId={user?.id ?? null}
          sort={sort}
        />
      </Suspense>
    </div>
  );
}
