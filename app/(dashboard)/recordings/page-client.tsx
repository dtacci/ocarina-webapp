"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Loader2, Disc3, ChevronDown, ChevronUp, Download, Disc, X } from "lucide-react";
import { RecordingCard } from "@/components/recordings/recording-card";
import { RecordingListProvider } from "@/components/recordings/recording-list-context";
import { useRecordingsRealtime } from "@/hooks/use-recordings-realtime";
import type { RecordingRow } from "@/lib/db/queries/recordings";

interface Props {
  initialRecordings: RecordingRow[];
  currentPage: number;
  hasMore: boolean;
  query: string;
  userId: string | null;
  sort: string;
  sessionId: string | null;
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

function groupSortKey(tracks: RecordingRow[], sort: string): number {
  switch (sort) {
    case "date-asc":
      return Math.min(...tracks.map((t) => new Date(t.created_at).getTime()));
    case "duration-desc":
      return tracks
        .filter((t) => t.recording_type !== "master")
        .reduce((s, t) => s + t.duration_sec, 0);
    case "bpm-desc":
      return tracks.find((t) => t.bpm != null)?.bpm ?? 0;
    default: // date-desc
      return Math.max(...tracks.map((t) => new Date(t.created_at).getTime()));
  }
}

// Group recordings by session_id. All groups (session + solo) sorted together.
// Within each session: master first, then stems by created_at asc.
function groupRecordings(
  recordings: RecordingRow[],
  sort: string
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

  const sessionGroups: Array<{ sessionId: string | null; tracks: RecordingRow[] }> = [];
  for (const [sessionId, tracks] of sessionMap) {
    const sorted = tracks.sort((a, b) => {
      if (a.recording_type === "master") return -1;
      if (b.recording_type === "master") return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    sessionGroups.push({ sessionId, tracks: sorted });
  }

  // Merge sessions + solo recordings, sort all by the active sort key
  const allGroups: Array<{ sessionId: string | null; tracks: RecordingRow[] }> = [
    ...sessionGroups,
    ...ungrouped.map((rec) => ({ sessionId: null, tracks: [rec] })),
  ];

  allGroups.sort((a, b) => {
    const ak = groupSortKey(a.tracks, sort);
    const bk = groupSortKey(b.tracks, sort);
    return sort === "date-asc" ? ak - bk : bk - ak;
  });

  return allGroups;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── SessionGroup ─────────────────────────────────────────────────────────────

function SessionGroup({
  sessionId,
  tracks,
  onDelete,
}: {
  sessionId: string;
  tracks: RecordingRow[];
  onDelete: (id: string) => void;
}) {
  const [stemsExpanded, setStemsExpanded] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const master = tracks.find((t) => t.recording_type === "master");
  const stems = tracks.filter((t) => t.recording_type !== "master");

  const stemDuration = stems.reduce((s, t) => s + t.duration_sec, 0);
  const bpm = (master ?? stems[0])?.bpm;
  const date = formatDate((master ?? stems[0]).created_at);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(false);
    try {
      const resp = await fetch(`/api/sessions/${sessionId}/export`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Format date as YYYY-MM-DD for the filename
      const fileDate = new Date((master ?? stems[0]).created_at)
        .toISOString().slice(0, 10);
      a.download = `ocarina-session-${fileDate}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(true);
      setTimeout(() => setDownloadError(false), 3000);
    } finally {
      setDownloading(false);
    }
  }

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

        {/* ZIP download — only shown when there's something to download */}
        {(stems.length > 0 || master) && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            title={downloadError ? "Download failed — try again" : "Download session as ZIP"}
            className={[
              "flex items-center gap-1 text-xs transition-colors shrink-0 px-2 py-1 rounded",
              downloadError
                ? "text-destructive hover:text-destructive/80"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
              downloading ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {downloading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Download className="size-3.5" />}
            <span className="hidden sm:inline">{downloadError ? "Error" : "ZIP"}</span>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Master card — full width hero */}
        {master && (
          <RecordingCard recording={master} onDelete={onDelete} />
        )}

        {/* Stems — collapsible when master exists */}
        {stems.length > 0 && (
          <div>
            {master && (
              <button
                onClick={() => setStemsExpanded((v) => !v)}
                className="flex w-full items-center gap-2 mb-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {stemsExpanded
                  ? <ChevronUp className="size-3.5" />
                  : <ChevronDown className="size-3.5" />}
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

// ── RecordingsClient ──────────────────────────────────────────────────────────

export function RecordingsClient({
  initialRecordings,
  currentPage,
  hasMore,
  query,
  userId,
  sort,
  sessionId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [recordings, setRecordings] = useState<RecordingRow[]>(initialRecordings);

  const prevInitial = useRef(initialRecordings);
  if (prevInitial.current !== initialRecordings) {
    prevInitial.current = initialRecordings;
    setRecordings(initialRecordings);
  }

  // Realtime: new recordings appear without refresh
  useRecordingsRealtime(userId, (newRecording) => {
    setRecordings((prev) => {
      if (prev.some((r) => r.id === newRecording.id)) return prev;
      return [newRecording, ...prev];
    });
  });

  // ── Search ──────────────────────────────────────────────────────────────────

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

  // ── Sort ────────────────────────────────────────────────────────────────────

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page"); // reset to page 1 on sort change
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) { params.delete("page"); } else { params.set("page", String(page)); }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // ── Delete (optimistic) ─────────────────────────────────────────────────────

  const handleDelete = useCallback((id: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const groups = groupRecordings(recordings, sort);

  return (
    <div className="space-y-4">
      {/* Toolbar: search + sort */}
      {/* Session filter banner */}
      {sessionId && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <Disc3 className="size-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground flex-1">Showing recordings from one session</span>
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("session_id");
              params.delete("page");
              router.push(`${pathname}?${params.toString()}`, { scroll: false });
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Clear session filter"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1">
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

        <select
          value={sort}
          onChange={(e) => handleSort(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground shrink-0"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="duration-desc">Longest first</option>
          <option value="bpm-desc">Highest BPM</option>
        </select>
      </div>

      {/* Grid */}
      {groups.length > 0 ? (
        <>
          <RecordingListProvider recordings={recordings}>
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
          </RecordingListProvider>

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
      ) : query ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No recordings matching &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Disc className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No recordings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload one above, or register a device to enable auto-sync
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
