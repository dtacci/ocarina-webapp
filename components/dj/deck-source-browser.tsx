"use client";

/**
 * Track picker for a deck: recordings / loop stems+masters / samples from the
 * library, or a local MP3/WAV file (decoded in the browser, never uploaded).
 */
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { DjSource } from "@/lib/db/queries/dj";

type Tab = "recordings" | "loops" | "samples" | "upload";

const TABS: { value: Tab; label: string }[] = [
  { value: "recordings", label: "recordings" },
  { value: "loops", label: "loops" },
  { value: "samples", label: "samples" },
  { value: "upload", label: "upload" },
];

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface DeckSourceBrowserProps {
  deckLabel: "A" | "B";
  sources: DjSource[];
  onPick: (source: DjSource) => void;
  onPickFile: (file: File) => void;
  onClose: () => void;
}

export function DeckSourceBrowser({
  deckLabel,
  sources,
  onPick,
  onPickFile,
  onClose,
}: DeckSourceBrowserProps) {
  const [tab, setTab] = useState<Tab>("recordings");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (tab === "recordings") {
      return sources.filter((s) => s.kind === "recording" && s.recordingType === "upload");
    }
    if (tab === "loops") {
      return sources.filter(
        (s) => s.kind === "recording" && (s.recordingType === "stem" || s.recordingType === "master"),
      );
    }
    if (tab === "samples") return sources.filter((s) => s.kind === "sample");
    return [];
  }, [sources, tab]);

  return (
    <div
      role="dialog"
      aria-label={`Load track into deck ${deckLabel}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="workbench flex max-h-[70vh] w-full max-w-xl flex-col border border-[color:var(--wb-line)] bg-[color:var(--ink-800)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--wb-line-soft)] px-4 py-3">
          <span className="workbench-label">
            load → deck <span className="text-[color:var(--wb-amber)]">{deckLabel}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="p-1 text-[color:var(--ink-500)] hover:text-[color:var(--ink-300)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[color:var(--wb-line-soft)] px-4 pt-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={tab === t.value}
              className={`workbench-label px-2.5 py-1.5 transition-colors ${
                tab === t.value
                  ? "border-b-2 border-[color:var(--wb-amber)] text-[color:var(--wb-amber)]"
                  : "text-[color:var(--ink-500)] hover:text-[color:var(--ink-300)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto p-2">
          {tab === "upload" ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="workbench-readout text-xs text-[color:var(--ink-500)] lowercase">
                mp3 / wav, decoded locally — nothing is uploaded
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="workbench-label border border-[color:var(--wb-amber-dim)] px-4 py-2 text-[color:var(--wb-amber)] hover:bg-[color:var(--wb-amber-glow)] transition-colors"
              >
                choose file…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.mp3,.wav"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[color:var(--ink-500)] lowercase">
              nothing here yet
            </p>
          ) : (
            <ul>
              {filtered.map((s) => (
                <li key={`${s.kind}-${s.id}`}>
                  <button
                    type="button"
                    onClick={() => onPick(s)}
                    className="flex w-full items-baseline gap-3 px-3 py-2 text-left hover:bg-[color:var(--ink-900)] transition-colors"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--ink-300)]">
                      {s.title}
                    </span>
                    {s.recordingType && s.recordingType !== "upload" ? (
                      <span className="workbench-label text-[9px] text-[color:var(--ink-500)]">
                        {s.recordingType}
                      </span>
                    ) : null}
                    {s.bpm ? (
                      <span className="workbench-readout text-[10px] text-[color:var(--ink-500)] tabular-nums">
                        {Math.round(s.bpm)} bpm
                      </span>
                    ) : null}
                    <span className="workbench-readout text-[10px] text-[color:var(--ink-500)] tabular-nums">
                      {fmtDur(s.durationSec)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
