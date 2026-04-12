"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Loader2, Disc3, ChevronDown, ChevronUp } from "lucide-react";
import { RecordingCard } from "@/components/recordings/recording-card";
import { useRecordingsRealtime } from "@/hooks/use-recordings-realtime";
import type { RecordingRow } from "@/lib/db/queries/recordings";

interface Props {
  initialRecordings: RecordingRow[];
  currentPage: number;
  hasMore: boolean;
  query: string;
  userId: string | null;
}

// Group recordings by session_id. Ungrouped (null) recordings each get their own entry.
// Within each session: master first, then stems sorted by created_at asc.
function groupRecordings(
  recordings: RecordingRow[]
): Array<{ sessionId: string | null; tracks: RecordingRow[] }> {
  const sessionMap = new Map<string, RecordingRow[]>();
  const ungrouped: RecordingRow[] = [];

  for (const rec of recordings) {
    if (rec.session_id) {
      if (!sessionMap.has(rec.session_id)) sessionMap.set(rec.session_id, []);
      sessionMap.get(rec.session_id)!.push(rec);
    } else {
      ungrouped.push(rec);
    }
  }

  const groups: Array<{ sessionId: string | null; tracks: RecordingRow[] }> = [];

  for (const [sessionId, tracks] of sessionMap) {
    // Master first, then stems by created_at asc
    const sorted = tracks.sort((a, b) => {
      if (a.recording_type === "master") return -1;
      if (b.recording_type === "master") return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    groups.push({ sessionId, tracks: sorted });
  }

  // Sessions sorted by most recent track (using the master or first stem)
  groups.sort((a, b) =>
    new Date(b.tracks[0].created_at).getTime() - new Date(a.tracks[0].created_at).getTime()
  );

  for (const rec of ungrouped) {
    groups.push({ sessionId: null, tracks: [rec] });
  }

  return groups;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function SessionGroup({
  tracks,
  onDelete,
}: {
  sessionId: string;
  tracks: RecordingRow[];
  onDelete: (id: string) => void;
}) {
  const [stemsExpanded, setStemsExpanded] = useState(true);

  const master = tracks.find((t) => t.recording_type === "master");
  const stems = tracks.filter((t) => t.recording_type !== "master");

  // Derive header metadata from stems (master duration covers the full mix, stems show individual)
  const stemDuration = stems.reduce((s, t) => s + t.duration_sec, 0);
  const bpm = (master ?? stems[0])?.bpm;
  const date = formatDate((master ?? stems[0]).created_at);

  return (
    <div className="col-span-full rounded-lg border bg-card/50 overflow-hidden">
      {/* Session header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/20">
        <Disc3 className="size-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Session · {date}</p>
          <p className="text-xs text-muted-foreground">
            {stems.length} {stems.length === 1 ? "stem" : "stems"}
            {stemDuration > 0 && ` · ${Math.floor(stemDuration / 60)}m ${Math.floor(stemDuration % 60)}s`}
            {bpm ? ` · ${bpm} BPM` : ""}
            {master ? " · mix ready" : ""}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Master card — hero, full width */}
        {master && (
          <RecordingCard recording={master} onDelete={onDelete} />
        )}

        {/* Stems — collapsible */}
        {stems.length > 0 && (
          <div>
            {master && (
              <button
                onClick={() => setStemsExpanded((v) => !v)}
                className="flex w-full items-center gap-2 mb-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {stemsExpanded
                  ? <ChevronUp className="size-3.5" />
                  : <ChevronDown className="size-3.5" />
                }
                Stems ({stems.length})
              </button>
            )}

            {stemsExpanded && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stems.map((rec) => (
                  <RecordingCard key={rec.id} recording={rec} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function RecordingsClient({
  initialRecordings,
  currentPage,
  hasMore,
  query,
  userId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [recordings, setRecordings] = useState<RecordingRow[]>(initialRecordings);

  // Sync when server refetches (search/page navigation)
  const prevInitial = useRef(initialRecordings);
  if (prevInitial.current !== initialRecordings) {
    prevInitial.current = initialRecordings;
    setRecordings(initialRecordings);
  }

  // Realtime: new recordings from Pi or browser uploads appear without a refresh
  useRecordingsRealtime(userId, (newRecording) => {
    setRecordings((prev) => {
      // Deduplicate — Pi may retry and send the same recording twice
      if (prev.some((r) => r.id === newRecording.id)) return prev;
      return [newRecording, ...prev];
    });
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) { params.set("q", value); } else { params.delete("q"); }
      params.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 300);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) { params.delete("page"); } else { params.set("page", String(page)); }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const handleDelete = useCallback((id: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const groups = groupRecordings(recordings);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search recordings…"
          defaultValue={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-md border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
        {isPending && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Grid — sessions grouped, ungrouped solo */}
      {groups.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) =>
              group.sessionId ? (
                <SessionGroup
                  key={group.sessionId}
                  sessionId={group.sessionId}
                  tracks={group.tracks}
                  onDelete={handleDelete}
                />
              ) : (
                <RecordingCard
                  key={group.tracks[0].id}
                  recording={group.tracks[0]}
                  onDelete={handleDelete}
                />
              )
            )}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {currentPage > 1 && (
              <button onClick={() => goToPage(currentPage - 1)} disabled={isPending}
                className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50">
                Previous
              </button>
            )}
            <span className="text-sm text-muted-foreground">Page {currentPage}</span>
            {hasMore && (
              <button onClick={() => goToPage(currentPage + 1)} disabled={isPending}
                className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50">
                Next
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {query ? `No recordings matching "${query}"` : "No recordings on this page."}
        </p>
      )}
    </div>
  );
}
