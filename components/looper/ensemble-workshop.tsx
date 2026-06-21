"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Loader2,
  Wand2,
  Play,
  Pause,
  Drum,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEnsemble } from "@/hooks/use-ensemble";
import { decodePreview, analyzePreview } from "@/lib/audio/preview-features";
import { DrumEngine } from "@/lib/audio/drum-engine";
import { BUILTIN_KITS, SYNTH_808_MANIFEST } from "@/lib/audio/drum-kit-manifest";
import type { EnsembleResult, IncomingGroove } from "@/lib/ensemble/types";
import type { Pattern } from "@/lib/audio/drum-engine";
import { EnsemblePads } from "./ensemble-pads";

interface SongSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  previewUrl: string | null;
  durationSec: number | null;
}

type GenStage = "idle" | "analyzing" | "matching";

interface EnsembleWorkshopProps {
  onBpm?: (bpm: number) => void;
  onSendDrums?: (groove: IncomingGroove) => void;
}

/**
 * "Sounds-like" workshop: look up a song (Deezer), analyze its 30s preview,
 * match each instrument to the library, and play the matched ensemble + drum
 * groove right here in the looper. Self-contained (own SamplerEngine + a private
 * DrumEngine) so it adds minimal surface area to the looper page; the groove can
 * be pushed into the editable step sequencer via onSendDrums.
 */
export function EnsembleWorkshop({ onBpm, onSendDrums }: EnsembleWorkshopProps) {
  const { ensemble, status, loadEnsemble, trigger, swapVoice } = useEnsemble();

  const drumEngineRef = useRef<DrumEngine | null>(null);
  if (drumEngineRef.current == null) drumEngineRef.current = new DrumEngine();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gen, setGen] = useState<GenStage>("idle");
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [activeVoiceIndex, setActiveVoiceIndex] = useState(0);
  const [drumPlaying, setDrumPlaying] = useState(false);
  const [hasDrums, setHasDrums] = useState(false);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      drumEngineRef.current?.dispose();
      drumEngineRef.current = null;
    };
  }, []);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setError("Couldn't search songs. Try again.");
      } finally {
        setSearching(false);
      }
    },
    [query],
  );

  const loadDrumGroove = useCallback(async (result: EnsembleResult) => {
    const engine = drumEngineRef.current;
    if (!engine || !result.drum) {
      setHasDrums(false);
      return;
    }
    const manifest = BUILTIN_KITS.find((k) => k.id === result.drum!.kitId) ?? SYNTH_808_MANIFEST;
    await engine.ensureContext();
    await engine.loadKit(manifest);
    engine.setPattern(result.drum.pattern);
    engine.setBpm(result.bpm);
    setHasDrums(true);
  }, []);

  const handleGenerate = useCallback(
    async (songId: string) => {
      setError(null);
      setActiveSongId(songId);
      setResults([]);
      setGen("analyzing");
      try {
        // 1. Resolve metadata (warms the cache + bpm hint).
        const metaRes = await fetch(`/api/songs/${encodeURIComponent(songId)}`);
        const meta = metaRes.ok ? await metaRes.json() : null;
        const bpmHint: number | null = meta?.song?.bpm ?? null;

        // 2. Analyze the preview locally (non-fatal — profiling still works without it).
        let previewFeatures:
          | { bpm: number; brightness: number; energy: number; drumPattern: Pattern }
          | undefined;
        try {
          const previewRes = await fetch(`/api/songs/${encodeURIComponent(songId)}/preview`);
          if (previewRes.ok) {
            const buf = await previewRes.arrayBuffer();
            const decoded = await decodePreview(buf);
            const f = await analyzePreview(decoded, { bpmHint });
            previewFeatures = {
              bpm: f.bpm,
              brightness: f.brightness,
              energy: f.energy,
              drumPattern: f.drumPattern,
            };
          }
        } catch (err) {
          console.warn("preview analysis failed; profiling without it", err);
        }

        // 3. Profile + match.
        setGen("matching");
        const matchRes = await fetch("/api/songs/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId, previewFeatures }),
        });
        if (!matchRes.ok) throw new Error("Match failed");
        const result: EnsembleResult = await matchRes.json();

        await loadEnsemble(result);
        setActiveVoiceIndex(Math.max(0, result.voices.findIndex((v) => v.url)));
        onBpm?.(result.bpm);
        await loadDrumGroove(result);
      } catch {
        setError("Couldn't build the ensemble. Try another song.");
      } finally {
        setGen("idle");
      }
    },
    [loadEnsemble, loadDrumGroove, onBpm],
  );

  const handleDeepAnalyze = useCallback(async () => {
    if (!activeSongId) return;
    setDeepAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/songs/${encodeURIComponent(activeSongId)}/deep-analyze`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Deep analyze failed");
      const result: EnsembleResult = await res.json();
      await loadEnsemble(result);
      setActiveVoiceIndex(Math.max(0, result.voices.findIndex((v) => v.url)));
      await loadDrumGroove(result);
    } catch {
      setError("Deep analyze isn't available right now.");
    } finally {
      setDeepAnalyzing(false);
    }
  }, [activeSongId, loadEnsemble, loadDrumGroove]);

  const toggleDrums = useCallback(async () => {
    const engine = drumEngineRef.current;
    if (!engine) return;
    if (engine.isRunning()) {
      engine.stop();
      setDrumPlaying(false);
      return;
    }
    await engine.ensureContext();
    engine.start();
    setDrumPlaying(true);
  }, []);

  const handlePlayNote = useCallback(
    (note: string) => {
      if (activeVoiceIndex < 0) return;
      trigger(activeVoiceIndex, note);
    },
    [activeVoiceIndex, trigger],
  );

  const handleSendDrums = useCallback(() => {
    if (!ensemble?.drum) return;
    onSendDrums?.({ kitId: ensemble.drum.kitId, pattern: ensemble.drum.pattern, bpm: ensemble.bpm });
  }, [ensemble, onSendDrums]);

  const busy = gen !== "idle";
  const matchedCount = ensemble?.voices.filter((v) => v.url).length ?? 0;

  return (
    <div className="rounded-xl border bg-card/50 p-4 backdrop-blur flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Wand2 className="size-5 text-amber-400" />
        <h2 className="text-xl font-bold tracking-tight">Sounds Like</h2>
        <Badge variant="secondary" className="text-[10px]">
          Beta
        </Badge>
        <span className="text-xs text-muted-foreground">
          Recreate a song with your library
        </span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a song — e.g. Three Little Birds"
          className="h-9"
          disabled={busy}
        />
        <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={busy || !query.trim()}>
          {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {/* Results */}
      {results.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {results.map((song) => (
            <li key={song.id}>
              <button
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                onClick={() => handleGenerate(song.id)}
                disabled={busy}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={song.albumArtUrl ?? ""}
                  alt=""
                  className="size-10 shrink-0 rounded bg-muted object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{song.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {song.artist}
                  </span>
                </span>
                {!song.previewUrl && (
                  <Badge variant="outline" className="text-[10px]">
                    no preview
                  </Badge>
                )}
                <Wand2 className="size-4 shrink-0 text-amber-400" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Generating progress */}
      {busy && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {gen === "analyzing" ? "Analyzing the preview…" : "Matching to your library…"}
        </div>
      )}

      {/* Result ensemble */}
      {ensemble && !busy && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {ensemble.profile.genre}
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px]">
              {ensemble.bpm} BPM
            </Badge>
            <span className="text-xs text-muted-foreground">
              matched {matchedCount} of {ensemble.voices.length} instruments
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8 gap-1.5 text-xs"
              onClick={handleDeepAnalyze}
              disabled={deepAnalyzing || !activeSongId}
              title="Separate the recording into stems for a more accurate match"
            >
              {deepAnalyzing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {ensemble.deepAnalyzed ? "Deep-analyzed" : "Deep analyze"}
            </Button>
          </div>

          <p className="text-xs italic text-muted-foreground">{ensemble.profile.interpretation}</p>

          <EnsemblePads
            voices={ensemble.voices}
            activeIndex={activeVoiceIndex}
            ready={status === "ready"}
            onSelectVoice={setActiveVoiceIndex}
            onPlayNote={handlePlayNote}
            onSwap={swapVoice}
          />

          {/* Drum groove transport */}
          {hasDrums && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                variant={drumPlaying ? "secondary" : "default"}
                size="sm"
                className="h-8 gap-1.5"
                onClick={toggleDrums}
              >
                {drumPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {drumPlaying ? "Stop groove" : "Play groove"}
              </Button>
              <Badge variant="outline" className="gap-1.5 text-[11px]">
                <Drum className="size-3" />
                {ensemble.drum?.kitId}
              </Badge>
              {onSendDrums && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 gap-1.5 text-xs"
                  onClick={handleSendDrums}
                  title="Load this groove into the drum step sequencer"
                >
                  <SendHorizontal className="size-3.5" />
                  Send to sequencer
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
