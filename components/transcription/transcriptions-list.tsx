"use client";

/**
 * Client list for the transcriptions browse view: cards link to the detail
 * page, with inline rename + delete (reusing PATCH/DELETE /api/recordings/[id]).
 */

import { useState } from "react";
import Link from "next/link";
import { FileMusic, Pencil, Trash2, Check, X } from "lucide-react";
import type { RecordingRow } from "@/lib/db/queries/recordings";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TranscriptionsList({ initial }: { initial: RecordingRow[] }) {
  const [sessions, setSessions] = useState<RecordingRow[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function rename(id: string) {
    const next = draft.trim() || "Untitled transcription";
    setEditingId(null);
    setSessions((s) => s.map((r) => (r.id === id ? { ...r, title: next } : r)));
    await fetch(`/api/recordings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: next }),
    }).catch(() => {/* best-effort */});
  }

  async function remove(id: string) {
    setConfirmId(null);
    setSessions((s) => s.filter((r) => r.id !== id)); // optimistic
    await fetch(`/api/recordings/${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center">
        <FileMusic className="mx-auto size-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">No transcriptions yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sing into your Ocarina and sync — each performance shows up here as
          engraved sheet music you can tweak, play back, and export.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((s) => (
        <li
          key={s.id}
          className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
        >
          {editingId === s.id ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void rename(s.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => void rename(s.id)}
                className="rounded-md border p-1.5 hover:bg-muted"
                aria-label="Save"
              >
                <Check className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/transcriptions/${s.id}`}
                className="font-medium leading-tight hover:text-primary"
              >
                {s.title ?? "Untitled transcription"}
              </Link>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => {
                    setDraft(s.title ?? "");
                    setEditingId(s.id);
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Rename"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => setConfirmId(confirmId === s.id ? null : s.id)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          {confirmId === s.id ? (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Delete this transcription?</span>
              <button
                onClick={() => void remove(s.id)}
                className="rounded bg-destructive px-2 py-0.5 text-destructive-foreground"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="rounded border px-2 py-0.5 hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {new Date(s.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" · "}
              {formatDuration(s.duration_sec)}
              {s.event_count != null ? ` · ${s.event_count} events` : ""}
              {s.is_public ? " · public" : ""}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
