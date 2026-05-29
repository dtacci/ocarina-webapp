"use client";

import { useState } from "react";
import { MessageSquare, Loader2, Send, Trash2, AlertTriangle } from "lucide-react";

import type { CaptureCommentRow } from "@/lib/db/queries/capture-comments";

interface Props {
  captureId: string;
  initialComments: CaptureCommentRow[];
  /** Logged-in user id; null = anonymous viewer (read-only form). */
  viewerId: string | null;
  /** Capture owner id — used to grant delete on any comment in the thread. */
  captureOwnerId: string;
}

export function CaptureComments({
  captureId,
  initialComments,
  viewerId,
  captureOwnerId,
}: Props) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/captures/${captureId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const { comment } = (await res.json()) as { comment: CaptureCommentRow };
      setComments((prev) => [...prev, comment]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
    } finally {
      setPosting(false);
    }
  }

  async function remove(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(
        `/api/captures/${captureId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setError("Delete failed");
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <MessageSquare className="size-3.5 text-muted-foreground" />
        Comments
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {comments.length}
        </span>
      </h2>

      {comments.length === 0 ? (
        <p className="mb-3 text-xs text-muted-foreground/70">
          No comments yet. {viewerId ? "Be the first." : "Sign in to be the first."}
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {comments.map((c) => {
            const canDelete =
              !!viewerId &&
              (viewerId === c.author_id || viewerId === captureOwnerId);
            return (
              <li
                key={c.id}
                className="group flex gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-baseline gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/90">
                      {displayAuthor(c)}
                    </span>
                    <span>{relative(c.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">
                    {c.body}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => { void remove(c.id); }}
                    className="invisible flex size-7 items-center justify-center rounded-md border border-border bg-card/40 text-muted-foreground hover:border-red-400/50 hover:text-red-300 group-hover:visible"
                    title="Delete comment"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {viewerId ? (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            maxLength={2000}
            rows={2}
            className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground/70">
              {draft.length}/2000
            </span>
            <button
              type="submit"
              disabled={posting || !draft.trim()}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {posting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              Comment
            </button>
          </div>
        </form>
      ) : (
        <p className="text-[11px] text-muted-foreground/70">
          <a href="/login" className="text-foreground underline-offset-2 hover:underline">
            Sign in
          </a>{" "}
          to comment.
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-300">
          <AlertTriangle className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function displayAuthor(c: CaptureCommentRow): string {
  if (c.author_display_name) return c.author_display_name;
  return `user ${c.author_id.slice(0, 6)}`;
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
