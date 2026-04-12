"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Heart, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const decades = ["60s", "70s", "80s", "90s", "2000s", "2010s"];

export function KaraokeFilters({ signedIn = false }: { signedIn?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeDecade = searchParams.get("decade") ?? "";
  const search = searchParams.get("q") ?? "";
  const favOnly = searchParams.get("fav") === "1";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // reset page on filter change
    router.push(`/karaoke?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search songs or artists..."
          defaultValue={search}
          onChange={(e) => {
            // Debounce-ish: only navigate on Enter or clear
            if (e.target.value === "") setParam("q", "");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setParam("q", e.currentTarget.value);
            }
          }}
          className="pl-8"
        />
      </div>

      {/* Decade + favorites filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setParam("decade", "")}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            !activeDecade ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {decades.map((d) => (
          <button
            key={d}
            onClick={() => setParam("decade", activeDecade === d ? "" : d)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              activeDecade === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}
          </button>
        ))}
        {signedIn && (
          <button
            onClick={() => setParam("fav", favOnly ? "" : "1")}
            aria-pressed={favOnly}
            className={cn(
              "flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
              favOnly
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart
              className={cn(
                "size-3",
                favOnly ? "fill-primary-foreground" : ""
              )}
            />
            Favorites
          </button>
        )}
      </div>
    </div>
  );
}
