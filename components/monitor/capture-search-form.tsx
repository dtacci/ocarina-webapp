"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

const SOURCES = [
  { value: "", label: "All sources" },
  { value: "pi_rest", label: "Pi REST" },
  { value: "realtime", label: "Realtime" },
  { value: "webserial", label: "WebSerial" },
] as const;

export function CaptureSearchForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState(() => sp.get("q") ?? "");
  const [source, setSource] = useState(() => sp.get("source") ?? "");

  // Keep local state in sync with URL when the user navigates back/forward.
  useEffect(() => {
    setQuery(sp.get("q") ?? "");
    setSource(sp.get("source") ?? "");
  }, [sp]);

  function commit(nextQuery: string, nextSource: string) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextSource) params.set("source", nextSource);
    const qs = params.toString();
    startTransition(() => {
      router.replace(`/monitor/captures${qs ? `?${qs}` : ""}`);
    });
  }

  function clear() {
    setQuery("");
    setSource("");
    startTransition(() => router.replace("/monitor/captures"));
  }

  const hasFilter = query.trim().length > 0 || source !== "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit(query, source);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <div className="relative min-w-0 flex-1 sm:min-w-[14rem]">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name + notes…"
          className="w-full rounded-md border bg-background px-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <select
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
          commit(query, e.target.value);
        }}
        className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {SOURCES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Search className="size-3" />
        Search
      </button>
      {hasFilter && (
        <button
          type="button"
          onClick={clear}
          disabled={pending}
          className="flex items-center gap-1 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </form>
  );
}
