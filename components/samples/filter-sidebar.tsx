"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";

const FAMILIES = [
  "strings",
  "brass",
  "woodwind",
  "keys",
  "mallet",
  "drums",
  "guitar",
  "other_perc",
  "other",
  "fx",
] as const;

const TOP_VIBES = [
  "warm", "dark", "bright", "soft", "sustained", "gentle",
  "mellow", "orchestral", "rich", "smooth", "crisp", "deep",
  "expressive", "intimate", "delicate", "bold", "ambient",
  "aggressive", "punchy", "ethereal", "staccato", "lyrical",
  "jazzy", "classical", "cinematic", "percussive",
];

export function FilterSidebar({
  familyCounts,
}: {
  familyCounts: Record<string, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeFamily = searchParams.get("family");
  const activeVibes = searchParams.get("vibes")?.split(",").filter(Boolean) || [];

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.delete("page"); // Reset pagination on filter change
      router.push(`/library?${params.toString()}`);
    },
    [router, searchParams]
  );

  const toggleVibe = useCallback(
    (vibe: string) => {
      const current = new Set(activeVibes);
      if (current.has(vibe)) {
        current.delete(vibe);
      } else {
        current.add(vibe);
      }
      const vibes = Array.from(current);
      setParam("vibes", vibes.length > 0 ? vibes.join(",") : null);
    },
    [activeVibes, setParam]
  );

  const clearAll = useCallback(() => {
    router.push("/library");
  }, [router]);

  const hasFilters = activeFamily || activeVibes.length > 0;

  return (
    <div className="w-56 shrink-0 space-y-4">
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="w-full justify-start gap-1.5">
          <X className="size-3.5" />
          Clear filters
        </Button>
      )}

      {/* Family filter */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground tracking-wider">
          Family
        </h3>
        <div className="space-y-0.5">
          {FAMILIES.map((f) => {
            const count = familyCounts[f] || 0;
            if (count === 0) return null;
            const isActive = activeFamily === f;
            return (
              <button
                key={f}
                onClick={() => setParam("family", isActive ? null : f)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span className="capitalize">{f.replace("_", " ")}</span>
                <span className={`text-xs ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Vibe filter */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground tracking-wider">
          Vibes
        </h3>
        <div className="flex flex-wrap gap-1">
          {TOP_VIBES.map((v) => {
            const isActive = activeVibes.includes(v);
            return (
              <Badge
                key={v}
                variant={isActive ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleVibe(v)}
              >
                {v}
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
}
