"use client";

import { useState } from "react";
import {
  Share2,
  Copy,
  RotateCw,
  Lock,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";

interface Props {
  captureId: string;
  initialIsPublic: boolean;
  initialShareToken: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function CaptureShareCard({
  captureId,
  initialIsPublic,
  initialShareToken,
}: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/captures/share/${shareToken}`
    : null;

  async function patch(payload: { isPublic?: boolean; rotateToken?: boolean }) {
    setState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/monitor/captures/${captureId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const { capture } = (await res.json()) as {
        capture: { is_public: boolean; share_token: string | null };
      };
      setIsPublic(capture.is_public);
      setShareToken(capture.share_token);
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("error");
    }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers — silently fail; user can select and copy manually.
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <Share2 className="size-3.5 text-muted-foreground" />
            Share
          </h2>
          <p className="text-xs text-muted-foreground">
            {isPublic
              ? "Anyone with the link can replay this capture."
              : "Captures stay private unless you opt in. The link is unguessable."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveBadge state={state} error={error} />
          <button
            type="button"
            disabled={state === "saving"}
            onClick={() => { void patch({ isPublic: !isPublic }); }}
            role="switch"
            aria-checked={isPublic}
            className={[
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isPublic ? "bg-emerald-500/70" : "bg-muted-foreground/30",
            ].join(" ")}
            title={isPublic ? "Revoke sharing" : "Enable public sharing"}
          >
            <span
              className={[
                "inline-block size-4 transform rounded-full bg-white shadow transition-transform",
                isPublic ? "translate-x-6" : "translate-x-1",
              ].join(" ")}
            />
          </button>
        </div>
      </div>

      {isPublic && shareUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 rounded-md border bg-background px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => { void copy(); }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            disabled={state === "saving"}
            onClick={() => {
              if (confirm("Rotate the share link? Old links stop working.")) {
                void patch({ rotateToken: true });
              }
            }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            title="Mint a fresh token; old links 404"
          >
            <RotateCw className="size-3" />
            Rotate
          </button>
        </div>
      )}

      {!isPublic && shareToken && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <Lock className="size-3" />
          Share link is dormant — re-enable to use the same token, or rotate
          for a fresh one when toggling back on.
        </p>
      )}
    </div>
  );
}

function SaveBadge({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
        <Check className="size-3" /> saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="flex items-center gap-1 font-mono text-[10px] text-red-400"
        title={error ?? undefined}
      >
        <AlertTriangle className="size-3" /> save failed
      </span>
    );
  }
  return null;
}
