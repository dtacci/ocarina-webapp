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
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Pencil,
  Check,
  Loader2,
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
 * Component-scoped styles (kept out of globals.css so the feature is
 * self-contained):
 *  - `.notation-paper` renders OSMD's black ink on a warm paper surface so the
 *    notation is readable over the app's dark theme — and looks like real sheet
 *    music. On print, browsers drop background colors by default, so it falls
 *    back to clean black-on-white automatically.
 *  - The print block isolates the notation for the "Print" button (doc §4.2).
 */
const COMPONENT_CSS = `
.notation-paper {
  background-color: #faf6ec;
  background-image: linear-gradient(180deg, #fdfaf3 0%, #f5efe1 100%);
  color: #1b1b1b;
  padding: 2rem 1.75rem;
  border-radius: 0.5rem;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 10px 30px -10px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(120, 90, 40, 0.08);
}
@media print {
  body * { visibility: hidden; }
  #notation-print, #notation-print * { visibility: visible; }
  #notation-print { position: absolute; inset: 0; border: none; padding: 0; box-shadow: none; }
  .notation-paper { box-shadow: none; background: #fff; }
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

  // Score zoom (re-renders OSMD without reloading).
  const [zoom, setZoom] = useState(1);
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2;
  const adjustZoom = (delta: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));

  // Synth playback → cursor follow.
  const [playheadSec, setPlayheadSec] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Inline title editing (owner only).
  const [title, setTitle] = useState(recording.title ?? "Untitled transcription");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  // "This looks wrong" feedback (owner only).
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  async function submitFeedback() {
    const message = feedbackText.trim();
    if (!message) return;
    setFeedbackSent(true);
    setFeedbackOpen(false);
    setFeedbackText("");
    await fetch(`/api/transcription/${recording.id}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, params }),
    }).catch(() => {/* best-effort */});
  }

  const exportBase = `/api/transcription/${recording.id}/export`;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function saveTitle() {
    const next = titleDraft.trim() || "Untitled transcription";
    setEditingTitle(false);
    if (next === title) return;
    const prev = title;
    setTitle(next); // optimistic
    try {
      const res = await fetch(`/api/recordings/${recording.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setTitle(prev); // revert on failure
    }
  }

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
      <style dangerouslySetInnerHTML={{ __html: COMPONENT_CSS }} />
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
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="w-full max-w-md rounded-md border bg-background px-2 py-1 text-2xl font-semibold tracking-tight focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => void saveTitle()}
                className="rounded-md border p-1.5 hover:bg-muted"
                aria-label="Save title"
              >
                <Check className="size-4" />
              </button>
            </div>
          ) : (
            <h1 className="group flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {title}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(title);
                    setEditingTitle(true);
                  }}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  aria-label="Edit title"
                >
                  <Pencil className="size-4" />
                </button>
              ) : null}
            </h1>
          )}
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

          {/* Zoom */}
          <div className="ml-auto flex items-center gap-1 rounded-md border px-1 py-0.5">
            <button
              type="button"
              onClick={() => adjustZoom(-0.25)}
              disabled={zoom <= ZOOM_MIN}
              className="rounded p-1.5 hover:bg-muted disabled:opacity-40"
              aria-label="Zoom out"
            >
              <ZoomOut className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="min-w-12 rounded px-1 py-1 text-xs tabular-nums hover:bg-muted"
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(0.25)}
              disabled={zoom >= ZOOM_MAX}
              className="rounded p-1.5 hover:bg-muted disabled:opacity-40"
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="rounded p-1.5 hover:bg-muted"
              aria-label="Fit"
              title="Reset to 100%"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>

        {showSynth ? (
          <div data-print-hide className="rounded-lg border bg-card p-2">
            <div className="flex justify-end px-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSynth(false);
                  setIsPlaying(false);
                  setPlayheadSec(null);
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close player"
              >
                <X className="size-4" />
              </button>
            </div>
            <ToneMidiPlayer
              midiBlobUrl={`${exportBase}?format=midi`}
              duration={recording.duration_sec}
              onTimeUpdate={(t) => setPlayheadSec(t)}
              onBpmChange={() => {}}
              onStateChange={(playing) => {
                setIsPlaying(playing);
                if (!playing) setPlayheadSec((p) => p); // keep position on pause
              }}
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

          <section id="notation-print" className="rounded-lg border bg-card p-3 sm:p-4 overflow-x-auto">
            {musicxml ? (
              <div className="relative mx-auto max-w-4xl">
                {busy ? (
                  <div
                    data-print-hide
                    className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow"
                  >
                    <Loader2 className="size-3.5 animate-spin" /> re-engraving…
                  </div>
                ) : null}
                <div className={`notation-paper transition-opacity ${busy ? "opacity-50" : ""}`}>
                  <NotationCanvas
                    musicxml={musicxml}
                    zoom={zoom}
                    playheadSec={showSynth ? playheadSec : null}
                    isPlaying={showSynth && isPlaying}
                    tempoBpm={params.tempo_bpm}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This session hasn&apos;t finished rendering yet. Check back in a moment.
              </p>
            )}
          </section>
        </div>

        {/* "This looks wrong" — friendly feedback (doc §6.7), owner only. */}
        {canEdit ? (
          <div data-print-hide className="text-sm">
            {feedbackSent ? (
              <p className="text-muted-foreground">
                Thanks — that helps us improve future transcriptions. 🙏
              </p>
            ) : feedbackOpen ? (
              <div className="space-y-2 rounded-lg border bg-card p-4">
                <label htmlFor="feedback" className="text-xs font-medium text-muted-foreground">
                  What did you mean to play? (a bar number, the right notes, anything)
                </label>
                <textarea
                  id="feedback"
                  autoFocus
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full rounded-md border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. bars 3–4 should be a steady quarter-note run, not dotted…"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void submitFeedback()}
                    disabled={!feedbackText.trim()}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-40"
                  >
                    Send feedback
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(false)}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                This doesn&apos;t look right?
              </button>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
