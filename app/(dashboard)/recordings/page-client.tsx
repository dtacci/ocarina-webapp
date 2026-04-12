"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { RecordingCard } from "@/components/recordings/recording-card";
import type { RecordingRow } from "@/lib/db/queries/recordings";

interface Props {
  initialRecordings: RecordingRow[];
  currentPage: number;
  hasMore: boolean;
  query: string;
}

export function RecordingsClient({
  initialRecordings,
  currentPage,
  hasMore,
  query,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local copy of recordings — allows optimistic deletion without page reload
  const [recordings, setRecordings] = useState<RecordingRow[]>(initialRecordings);

  // Sync with server when initialRecordings prop changes (new search/page)
  const prevInitial = useRef(initialRecordings);
  if (prevInitial.current !== initialRecordings) {
    prevInitial.current = initialRecordings;
    setRecordings(initialRecordings);
  }

  // ── Search ───────────────────────────────────────────────────────────────────

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      params.delete("page"); // reset to page 1 on new search
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 300);
  }

  // ── Pagination ───────────────────────────────────────────────────────────────

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = useCallback((id: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Search bar */}
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

      {/* Grid */}
      {recordings.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recordings.map((rec) => (
              <RecordingCard key={rec.id} recording={rec} onDelete={handleDelete} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 pt-2">
            {currentPage > 1 && (
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={isPending}
                className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Previous
              </button>
            )}
            <span className="text-sm text-muted-foreground">Page {currentPage}</span>
            {hasMore && (
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={isPending}
                className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
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
