"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  Play,
  Square,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { ProviderToggle } from "@/components/ai/provider-toggle";
import type { SampleSearchResult } from "@/lib/ai/schemas";
import type { SemanticResult } from "@/lib/db/queries/semantic-search";

interface SearchResponse extends SampleSearchResult {
  queryId: string;
  semantic: boolean;
  results: SemanticResult[];
}

/** Fire-and-forget interaction event (docs/EVENTS.md). */
function sendEvent(
  eventType: string,
  queryId: string,
  sampleId: string,
  payload: Record<string, unknown>,
) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [
        { event_type: eventType, query_id: queryId, sample_id: sampleId, payload },
      ],
    }),
  }).catch(() => {});
}

export function AISearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, 1 | -1>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  function libraryParams(result: SampleSearchResult): string {
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
    return params.toString();
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);
    setRatings({});

    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) throw new Error("Search failed");

      const result: SearchResponse = await res.json();
      setResponse(result);

      // No vector results — preserve the original behavior: jump straight
      // to the filtered library view.
      if (!result.semantic || result.results.length === 0) {
        router.push(`/library?${libraryParams(result)}`);
      }
    } catch {
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }

  function togglePlay(r: SemanticResult) {
    if (!r.mp3BlobUrl || !response) return;
    if (playingId === r.sampleId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(r.mp3BlobUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    void audio.play();
    setPlayingId(r.sampleId);
    sendEvent("search_result_played", response.queryId, r.sampleId, {
      rank: r.rank,
    });
  }

  function rate(r: SemanticResult, rating: 1 | -1) {
    if (!response) return;
    setRatings((prev) => ({ ...prev, [r.sampleId]: rating }));
    sendEvent("search_result_rated", response.queryId, r.sampleId, {
      rank: r.rank,
      rating,
    });
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

      {response && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
          <p className="text-muted-foreground italic">{response.interpretation}</p>
          <div className="flex flex-wrap gap-1.5">
            {response.family && (
              <Badge variant="secondary">family: {response.family}</Badge>
            )}
            {response.vibes.map((v) => (
              <Badge key={v} variant="outline">{v}</Badge>
            ))}
            {response.brightnessRange && (
              <Badge variant="secondary">
                brightness: {response.brightnessRange[0]}-{response.brightnessRange[1]}
              </Badge>
            )}
            {response.warmthRange && (
              <Badge variant="secondary">
                warmth: {response.warmthRange[0]}-{response.warmthRange[1]}
              </Badge>
            )}
          </div>
        </div>
      )}

      {response && response.results.length > 0 && (
        <div className="rounded-lg border divide-y">
          {response.results.map((r) => (
            <div key={r.sampleId} className="flex items-center gap-2 p-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => togglePlay(r)}
                disabled={!r.mp3BlobUrl}
                title={r.mp3BlobUrl ? "Preview" : "Audio lives on the Pi"}
              >
                {playingId === r.sampleId ? (
                  <Square className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
              </Button>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/library/${encodeURIComponent(r.sampleId)}`}
                  className="block truncate text-sm font-medium hover:underline"
                  onClick={() =>
                    sendEvent("search_result_played", response.queryId, r.sampleId, {
                      rank: r.rank,
                      via: "detail_click",
                    })
                  }
                >
                  {r.title ?? r.sampleId}
                </Link>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {r.family && <span>{r.family}</span>}
                  {r.vibes.slice(0, 3).map((v) => (
                    <Badge key={v} variant="outline" className="px-1 py-0 text-[10px]">
                      {v}
                    </Badge>
                  ))}
                  <span className="ml-auto tabular-nums">
                    {(r.score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${ratings[r.sampleId] === 1 ? "text-green-600" : "text-muted-foreground"}`}
                  onClick={() => rate(r, 1)}
                >
                  <ThumbsUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${ratings[r.sampleId] === -1 ? "text-red-600" : "text-muted-foreground"}`}
                  onClick={() => rate(r, -1)}
                >
                  <ThumbsDown className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <div className="p-2 text-center">
            <Link
              href={`/library?${libraryParams(response)}`}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              view all matches in library →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
