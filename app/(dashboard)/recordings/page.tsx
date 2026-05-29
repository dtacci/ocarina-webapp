import Link from "next/link";
import { Suspense } from "react";
import { Disc3, FolderOpen, Music, Sparkles, Globe } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  getRecordings,
  getRecordingStats,
  type RecordingType,
  type SortOption,
} from "@/lib/db/queries/recordings";
import { UploadButton } from "@/components/recordings/upload-button";
import { RecordingsClient } from "./page-client";

const PAGE_SIZE = 12;
const VALID_TYPES: RecordingType[] = ["upload", "stem", "master"];

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    session_id?: string;
    type?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const VALID_SORTS: SortOption[] = ["date-desc", "date-asc", "duration-desc", "bpm-desc"];
  const sort: SortOption = VALID_SORTS.includes(sp.sort as SortOption)
    ? (sp.sort as SortOption)
    : "date-desc";
  const type = VALID_TYPES.includes(sp.type as RecordingType)
    ? (sp.type as RecordingType)
    : undefined;
  const session_id = sp.session_id;

  // Get userId so the client can subscribe to Realtime recording inserts.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [recordings, stats] = await Promise.all([
    getRecordings({
      limit: PAGE_SIZE + 1,
      page,
      query: q,
      sort,
      sessionId: session_id,
      type,
    }),
    getRecordingStats(),
  ]);
  const hasMore = recordings.length > PAGE_SIZE;
  const pageRecordings = recordings.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recordings</h1>
          <p className="text-muted-foreground">
            Your recording library. Auto-synced from your Ocarina.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/recordings/explore"
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Browse publicly-shared recordings across users"
          >
            <Globe className="size-3" />
            Explore public
          </Link>
          <UploadButton />
        </div>
      </div>

      {stats.totalCount > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Recordings" value={stats.totalCount} icon={Disc3} />
          <StatTile label="Minutes" value={stats.totalMinutes} icon={Sparkles} />
          <StatTile label="Stems" value={stats.byType.stem} icon={Music} />
          <StatTile label="Masters" value={stats.byType.master} icon={FolderOpen} />
        </div>
      )}

      <Suspense fallback={null}>
        <RecordingsClient
          initialRecordings={pageRecordings}
          currentPage={page}
          hasMore={hasMore}
          query={q}
          userId={user?.id ?? null}
          sort={sort}
          sessionId={session_id ?? null}
          type={type ?? null}
        />
      </Suspense>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
