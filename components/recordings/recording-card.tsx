"use client";

import { useState, useRef, useEffect } from "react";
import {
  Play, Pause, Volume2, VolumeX, Download, Loader2, Music, Clock,
  Trash2, Pencil, Globe, Link, Share2, Check, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWaveSurfer } from "@/components/audio/use-wavesurfer";
import type { RecordingRow } from "@/lib/db/queries/recordings";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  recording: RecordingRow;
  onDelete?: (id: string) => void;
}

export function RecordingCard({ recording, onDelete }: Props) {
  const [muted, setMuted] = useState(false);

  // Editable state — mirrors recording fields optimistically
  const [title, setTitle] = useState(recording.title ?? "Untitled");
  const [isPublic, setIsPublic] = useState(recording.is_public);

  // UI state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [titleError, setTitleError] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [copied, setCopied] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    containerRef,
    isReady,
    isPlaying,
    currentTime,
    duration: wsDuration,
    togglePlay,
    setMuted: wsSetMuted,
  } = useWaveSurfer({
    url: recording.blob_url,
    height: 48,
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
    lazy: true,
  });

  const displayDuration = wsDuration > 0 ? wsDuration : recording.duration_sec;

  // Focus input when editing starts
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  function handleMuteToggle() {
    const next = !muted;
    setMuted(next);
    wsSetMuted(next);
  }

  // ── Title editing ────────────────────────────────────────────────────────────

  function startEditingTitle() {
    setTitleDraft(title);
    setEditingTitle(true);
    setTitleError(false);
  }

  async function commitTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === title) {
      setEditingTitle(false);
      return;
    }

    // Optimistic update
    setTitle(trimmed);
    setEditingTitle(false);

    try {
      const res = await fetch(`/api/recordings/${recording.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setTitle(title);
      setTitleError(true);
      setTimeout(() => setTitleError(false), 3000);
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitTitle();
    if (e.key === "Escape") setEditingTitle(false);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(false);
    try {
      const res = await fetch(`/api/recordings/${recording.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteOpen(false);
      onDelete?.(recording.id);
    } catch {
      setDeleting(false);
      setDeleteError(true);
    }
  }

  // ── Share ────────────────────────────────────────────────────────────────────

  async function togglePublic() {
    const next = !isPublic;
    setIsPublic(next); // optimistic
    try {
      const res = await fetch(`/api/recordings/${recording.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setIsPublic(isPublic); // revert
    }
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/embed/${recording.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for HTTP or sandboxed contexts
      window.prompt("Copy share link:", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group rounded-lg border bg-card p-4 space-y-3 hover:border-foreground/20 transition-colors">
      {/* Waveform */}
      <div className="relative h-12 rounded bg-muted overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        {!isReady && (
          <Skeleton className="absolute inset-0 rounded" />
        )}
      </div>

      {/* Title */}
      <div>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={commitTitle}
            className="w-full text-sm font-medium bg-transparent border-b border-primary outline-none pb-0.5"
            maxLength={200}
          />
        ) : (
          <button
            onClick={startEditingTitle}
            className={[
              "group/title flex items-center gap-1.5 text-left w-full",
              titleError ? "text-destructive" : "",
            ].join(" ")}
            title="Click to edit title"
          >
            <span className="font-medium text-sm truncate">
              {title}
            </span>
            <Pencil className="size-3 text-muted-foreground/0 group-hover/title:text-muted-foreground/60 transition-colors shrink-0" />
          </button>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(displayDuration)}
          </span>
          {recording.bpm && (
            <span className="flex items-center gap-1">
              <Music className="size-3" />
              {recording.bpm} BPM
            </span>
          )}
          <span>{formatDate(recording.created_at)}</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
        >
          {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-px" />}
        </button>

        <span className="text-xs tabular-nums text-muted-foreground w-9 shrink-0">
          {formatDuration(currentTime)}
        </span>

        {/* Badges */}
        <div className="flex flex-1 flex-wrap gap-1">
          {recording.kit_id && (
            <Badge variant="secondary" className="text-xs capitalize">
              {recording.kit_id.replace(/-/g, " ")}
            </Badge>
          )}
          {isPublic && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">public</Badge>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mute */}
          <button
            onClick={handleMuteToggle}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>

          {/* Download */}
          <a
            href={recording.blob_url}
            download
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Download"
          >
            <Download className="size-3.5" />
          </a>

          {/* Share */}
          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Share"
            >
              <Share2 className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3">
              <p className="text-xs font-medium">Share recording</p>
              {/* Public toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="size-3.5 text-muted-foreground" />
                  <span>Public</span>
                </div>
                <button
                  onClick={togglePublic}
                  className={[
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    isPublic ? "bg-primary" : "bg-muted-foreground/30",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                      isPublic ? "translate-x-4" : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
              </div>
              {/* Copy link */}
              {isPublic && (
                <button
                  onClick={copyShareLink}
                  className="flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Link className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Copy share link</span>
                    </>
                  )}
                </button>
              )}
            </PopoverContent>
          </Popover>

          {/* Delete */}
          <Popover open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) { setDeleteError(false); setDeleting(false); } }}>
            <PopoverTrigger
              className="text-muted-foreground hover:text-destructive transition-colors p-1 opacity-0 group-hover:opacity-100"
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3">
              <p className="text-sm font-medium">Delete this recording?</p>
              <p className="text-xs text-muted-foreground">
                The audio file will be permanently removed. This cannot be undone.
              </p>
              {deleteError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="size-3" /> Delete failed — try again
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteOpen(false)}
                  className="flex-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {deleting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
