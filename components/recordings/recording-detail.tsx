"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Play, Pause, Download, Loader2, Music, Clock, Calendar,
  ArrowLeft, Trash2, Pencil, Globe, Link as LinkIcon, Share2,
  Check, X, Volume2, VolumeX,
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
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  recording: RecordingRow;
  isOwner: boolean;
  isAuthenticated: boolean;
}

export function RecordingDetail({ recording, isOwner, isAuthenticated }: Props) {
  const [title, setTitle] = useState(recording.title ?? "Untitled");
  const [isPublic, setIsPublic] = useState(recording.is_public);
  const [muted, setMutedState] = useState(false);

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
    height: 96,
    barWidth: 3,
    barGap: 1,
    barRadius: 2,
    // Not lazy — it's the hero element, the only waveform on the page
  });

  const displayDuration = wsDuration > 0 ? wsDuration : recording.duration_sec;

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  // ── Mute ────────────────────────────────────────────────────────────────────

  function handleMuteToggle() {
    const next = !muted;
    setMutedState(next);
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
    const prev = title;
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
      setTitle(prev);
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
      // Navigate away after deletion
      window.location.href = "/recordings";
    } catch {
      setDeleting(false);
      setDeleteError(true);
    }
  }

  // ── Share / Public toggle ────────────────────────────────────────────────────

  async function togglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    try {
      const res = await fetch(`/api/recordings/${recording.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setIsPublic(isPublic);
    }
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/recordings/${recording.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy share link:", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b px-4 sm:px-6 py-3 flex items-center justify-between">
        {isAuthenticated ? (
          <Link
            href="/recordings"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            My Library
          </Link>
        ) : (
          <span className="text-sm font-semibold tracking-tight">Digital Ocarina</span>
        )}

        {/* Owner actions in top bar */}
        {isOwner && (
          <div className="flex items-center gap-2">
            {/* Share popover */}
            <Popover open={shareOpen} onOpenChange={setShareOpen}>
              <PopoverTrigger className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                <Share2 className="size-3.5" />
                Share
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3">
                <p className="text-xs font-medium">Share recording</p>
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
                    <span className={[
                      "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                      isPublic ? "translate-x-4" : "translate-x-0.5",
                    ].join(" ")} />
                  </button>
                </div>
                {isPublic && (
                  <button
                    onClick={copyShareLink}
                    className="flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    {copied ? (
                      <><Check className="size-3.5 text-emerald-500" /><span className="text-emerald-600">Copied!</span></>
                    ) : (
                      <><LinkIcon className="size-3.5 text-muted-foreground" /><span className="text-muted-foreground">Copy link</span></>
                    )}
                  </button>
                )}
              </PopoverContent>
            </Popover>

            {/* Delete popover */}
            <Popover open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) { setDeleteError(false); setDeleting(false); } }}>
              <PopoverTrigger className="rounded-md border px-2.5 py-1.5 text-muted-foreground hover:text-destructive hover:border-destructive transition-colors">
                <Trash2 className="size-3.5" />
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3">
                <p className="text-sm font-medium">Delete this recording?</p>
                <p className="text-xs text-muted-foreground">Permanently removes the audio file. Cannot be undone.</p>
                {deleteError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="size-3" /> Delete failed — try again
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setDeleteOpen(false)} disabled={deleting}
                    className="flex-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                    {deleting ? <Loader2 className="size-3 animate-spin" /> : "Delete"}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
        {/* Title */}
        <div>
          {isOwner && editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={commitTitle}
              className="w-full text-2xl font-bold tracking-tight bg-transparent border-b-2 border-primary outline-none pb-1"
              maxLength={200}
            />
          ) : (
            <button
              onClick={isOwner ? startEditingTitle : undefined}
              className={[
                "group/title flex items-center gap-2 text-left",
                isOwner ? "cursor-pointer" : "cursor-default",
                titleError ? "text-destructive" : "",
              ].join(" ")}
            >
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {isOwner && (
                <Pencil className="size-4 text-muted-foreground/0 group-hover/title:text-muted-foreground/50 transition-colors shrink-0 mt-0.5" />
              )}
            </button>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatDuration(displayDuration)}
            </span>
            {recording.bpm && (
              <span className="flex items-center gap-1">
                <Music className="size-3.5" />
                {recording.bpm} BPM
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {formatDate(recording.created_at)}
            </span>
            {recording.kit_id && (
              <Badge variant="secondary" className="capitalize text-xs">
                {recording.kit_id.replace(/-/g, " ")}
              </Badge>
            )}
            {isPublic && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">public</Badge>
            )}
          </div>
        </div>

        {/* Waveform — hero element */}
        <div className="relative h-24 rounded-lg bg-muted overflow-hidden">
          <div ref={containerRef} className="absolute inset-0" />
          {!isReady && (
            <Skeleton className="absolute inset-0 rounded-lg" />
          )}
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!isReady}
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
          >
            {isPlaying
              ? <Pause className="size-4" />
              : <Play className="size-4 ml-0.5" />}
          </button>

          <span className="text-sm tabular-nums text-muted-foreground">
            {formatDuration(currentTime)} / {formatDuration(displayDuration)}
          </span>

          <div className="flex-1" />

          <button
            onClick={handleMuteToggle}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>

          <a
            href={recording.blob_url}
            download
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Download"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </div>

      {/* Visitor branding footer */}
      {!isAuthenticated && (
        <div className="fixed bottom-0 inset-x-0 border-t bg-card/80 backdrop-blur-sm px-4 py-3">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Played on <span className="font-medium text-foreground">Digital Ocarina</span>
            </p>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Make your own →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
