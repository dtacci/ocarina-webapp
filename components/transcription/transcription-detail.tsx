"use client";

/**
 * Transcription session detail — sheet-music view (doc §6.1).
 *
 * Owner sees interpretation controls and edits re-derive live: on a parameter
 * change we hash the params, check the server render cache, and on a miss derive
 * in-browser for instant feedback then write the result back to the cache
 * (doc §3.8). Public viewers get the read-only default render.
 *
 * Mirrors the dual-mode structure of components/recordings/recording-detail.tsx.
 */

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Music4,
  AlertTriangle,
  ChevronDown,
  Download,
  Printer,
  Play,
  X,
} from "lucide-react";
import type { RecordingRow } from "@/lib/db/queries/recordings";
import { derive } from "@/lib/transcription/derive";
import { paramsHash } from "@/lib/transcription/params-hash";
import {
  DEFAULT_PARAMS,
  type DeriveParams,
  type KeyCandidate,
  type OcarinaEvent,
  type OcarinaHeader,
  type Warning,
} from "@/lib/transcription/types";
import { InterpretationControls } from "./interpretation-controls";

const NotationCanvas = dynamic(
  () => import("@/components/transcription/notation-canvas"),
  { ssr: false },
);

// Reuse the karaoke MIDI player for synth playback (doc §5). Client-only.
const ToneMidiPlayer = dynamic(
  () => import("@/components/karaoke/tone-midi-player"),
  { ssr: false },
);

export interface TranscriptionDetailProps {
  recording: RecordingRow;
  musicxml: string | null;
  warnings: Warning[];
  isOwner: boolean;
  isAuthenticated: boolean;
  /** Owner-only: raw events + header enable in-browser re-derivation. */
  events?: OcarinaEvent[] | null;
  header?: OcarinaHeader | null;
  initialParams?: DeriveParams | null;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Print stylesheet (doc §4.2 stand-in): isolate the engraved notation so the
 * browser "Print" button produces clean vector sheet music. Scoped here rather
 * than in globals.css so the feature stays self-contained.
 */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #notation-print, #notation-print * { visibility: visible; }
  #notation-print { position: absolute; inset: 0; border: none; padding: 0; }
  [data-print-hide] { display: none !important; }
}`;

export function TranscriptionDetail({
  recording,
  musicxml: initialMusicxml,
  warnings: initialWarnings,
  isOwner,
  events,
  header,
  initialParams,
}: TranscriptionDetailProps) {
  const canEdit = isOwner && !!events && !!header;

  const [params, setParams] = useState<DeriveParams>(initialParams ?? DEFAULT_PARAMS);
  const [musicxml, setMusicxml] = useState<string | null>(initialMusicxml);
  const [warnings, setWarnings] = useState<Warning[]>(initialWarnings);
  const [keyCandidates, setKeyCandidates] = useState<KeyCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [showSynth, setShowSynth] = useState(false);

  const exportBase = `/api/transcription/${recording.id}/export`;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function recompute(next: DeriveParams) {
    if (!events || !header) return;
    setBusy(true);
    try {
      const hash = await paramsHash(next);
      // Cache hit → use the server's MusicXML (cheap, already engraved).
      const res = await fetch(
        `/api/transcription/${recording.id}/render?hash=${hash}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.hit && data.musicxml) {
          setMusicxml(data.musicxml);
          if (data.notation?.warnings) setWarnings(data.notation.warnings);
          setBusy(false);
          return;
        }
      }
      // Cache miss → derive in-browser for instant feedback, then write back.
      const result = derive(events, header, next, { title: recording.title ?? undefined });
      setMusicxml(result.musicxml);
      setWarnings(result.warnings);
      setKeyCandidates(result.keyCandidates);
      void fetch(`/api/transcription/${recording.id}/render`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          params: next,
          musicxml: result.musicxml,
          notation: {
            notes: result.notes,
            chapters: result.chapters,
            warnings: result.warnings,
          },
        }),
      }).catch(() => {/* write-back is best-effort */});
    } finally {
      setBusy(false);
    }
  }

  function handleChange(patch: Partial<DeriveParams>) {
    const next = { ...params, ...patch };
    setParams(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void recompute(next), 300);
  }

  const created = new Date(recording.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div data-print-hide className="border-b px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link
          href="/transcriptions"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Transcriptions
        </Link>
        <span className="text-sm font-semibold tracking-tight">Digital Ocarina</span>
      </div>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Music4 className="size-5" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sheet music
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {recording.title ?? "Untitled transcription"}
          </h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {created} · {formatDuration(recording.duration_sec)}
            {recording.event_count != null ? ` · ${recording.event_count} events` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Here&apos;s our best read of what you sang. It won&apos;t always be
            perfect — tweak the tempo, key, and timing to taste.
          </p>
        </header>

        {/* Toolbar: export + print + synth playback (hidden when printing). */}
        <div data-print-hide className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSynth((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Play className="size-4" /> {showSynth ? "Hide player" : "Play synth"}
          </button>
          <a
            href={`${exportBase}?format=musicxml`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Download className="size-4" /> MusicXML
          </a>
          <a
            href={`${exportBase}?format=midi`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Download className="size-4" /> MIDI
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Printer className="size-4" /> Print
          </button>
        </div>

        {showSynth ? (
          <div data-print-hide className="rounded-lg border bg-card p-2">
            <div className="flex justify-end px-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSynth(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close player"
              >
                <X className="size-4" />
              </button>
            </div>
            <ToneMidiPlayer
              midiBlobUrl={`${exportBase}?format=midi`}
              duration={recording.duration_sec}
              onTimeUpdate={() => {}}
              onBpmChange={() => {}}
              onStateChange={() => {}}
            />
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="rounded-lg border bg-muted/30">
            <button
              type="button"
              onClick={() => setWarningsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm"
              aria-expanded={warningsOpen}
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="size-4" />
                {warnings.length} thing{warnings.length === 1 ? "" : "s"} to know
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${warningsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {warningsOpen ? (
              <ul className="space-y-1.5 border-t px-4 py-3 text-sm text-muted-foreground">
                {warnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">•</span>
                    {w.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div
          className={
            canEdit ? "grid gap-6 lg:grid-cols-[260px_1fr]" : ""
          }
        >
          {canEdit ? (
            <InterpretationControls
              params={params}
              keyCandidates={keyCandidates}
              busy={busy}
              onChange={handleChange}
            />
          ) : null}

          <section id="notation-print" className="rounded-lg border bg-card p-4 sm:p-6 overflow-x-auto">
            {musicxml ? (
              <div className={busy ? "opacity-50 transition-opacity" : "transition-opacity"}>
                <NotationCanvas musicxml={musicxml} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This session hasn&apos;t finished rendering yet. Check back in a moment.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
