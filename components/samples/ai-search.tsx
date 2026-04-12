"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2 } from "lucide-react";
import { ProviderToggle } from "@/components/ai/provider-toggle";
import type { SampleSearchResult } from "@/lib/ai/schemas";

export function AISearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [interpretation, setInterpretation] = useState<SampleSearchResult | null>(null);
  const router = useRouter();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setInterpretation(null);

    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) throw new Error("Search failed");

      const result: SampleSearchResult = await res.json();
      setInterpretation(result);

      // Build URL params from AI interpretation
      const params = new URLSearchParams();
      if (result.vibes.length > 0) params.set("vibes", result.vibes.join(","));
      if (result.family) params.set("family", result.family);
      if (result.brightnessRange) {
        params.set("bMin", String(result.brightnessRange[0]));
        params.set("bMax", String(result.brightnessRange[1]));
      }
      if (result.warmthRange) {
        params.set("wMin", String(result.warmthRange[0]));
        params.set("wMax", String(result.warmthRange[1]));
      }
      if (result.attackRange) {
        params.set("aMin", String(result.attackRange[0]));
        params.set("aMax", String(result.attackRange[1]));
      }
      if (result.sustainRange) {
        params.set("sMin", String(result.sustainRange[0]));
        params.set("sMax", String(result.sustainRange[1]));
      }

      router.push(`/library?${params.toString()}`);
    } catch {
      setInterpretation(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          AI Search
        </span>
        <ProviderToggle />
      </div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "warm dark brass for a rainy afternoon"'
            className="pl-8"
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {interpretation && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
          <p className="text-muted-foreground italic">
            {interpretation.interpretation}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {interpretation.family && (
              <Badge variant="secondary">
                family: {interpretation.family}
              </Badge>
            )}
            {interpretation.vibes.map((v) => (
              <Badge key={v} variant="outline">{v}</Badge>
            ))}
            {interpretation.brightnessRange && (
              <Badge variant="secondary">
                brightness: {interpretation.brightnessRange[0]}-{interpretation.brightnessRange[1]}
              </Badge>
            )}
            {interpretation.warmthRange && (
              <Badge variant="secondary">
                warmth: {interpretation.warmthRange[0]}-{interpretation.warmthRange[1]}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
