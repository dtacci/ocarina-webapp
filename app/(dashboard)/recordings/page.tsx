import { Suspense } from "react";
import { Disc3 } from "lucide-react";
import { getRecordings } from "@/lib/db/queries/recordings";
import { UploadButton } from "@/components/recordings/upload-button";
import { RecordingsClient } from "./page-client";

const PAGE_SIZE = 12;

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);

  // Fetch one extra to determine if there's a next page
  const recordings = await getRecordings({ limit: PAGE_SIZE + 1, page, query: q });
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

      {recordings.length === 0 && !q ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Disc3 className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No recordings yet</p>
            <p className="text-xs text-muted-foreground">
              Upload a recording above, or register a device to enable auto-sync
            </p>
          </div>
        </div>
      ) : (
        <Suspense fallback={null}>
          <RecordingsClient
            initialRecordings={pageRecordings}
            currentPage={page}
            hasMore={hasMore}
            query={q}
          />
        </Suspense>
      )}
    </div>
  );
}
