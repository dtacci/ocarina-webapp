"use client";

import { useState } from "react";
import { Loader2, Sparkles, Check, X } from "lucide-react";

import type { DeriveParams } from "@/lib/transcription/types";

interface Proposal {
  params: DeriveParams;
  explanation: string;
  confidence: "low" | "medium" | "high";
}

interface Props {
  sessionId: string;
  currentParams: DeriveParams;
  busy: boolean;
  /** Applies the proposed params through the normal re-derivation path. */
  onApply: (params: DeriveParams) => void;
}

function sendOutcome(
  eventType: "cleanup_accepted" | "cleanup_rejected",
  sessionId: string,
  proposal: Proposal,
  currentParams: DeriveParams,
) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [
        {
          event_type: eventType,
          session_id: sessionId,
          payload: {
            params_before: currentParams,
            params_after: proposal.params,
            confidence: proposal.confidence,
          },
        },
      ],
    }),
  }).catch(() => {});
}

/**
 * "Fix it with AI": Claude reviews the session's event stats + feedback and
 * proposes adjusted interpretation params. Accept routes through the normal
 * derive path; both outcomes are logged as training labels (docs/EVENTS.md).
 */
export function AiCleanup({ sessionId, currentParams, busy, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState(false);

  async function propose() {
    setLoading(true);
    setError(false);
    setProposal(null);
    try {
      const res = await fetch(`/api/transcription/${sessionId}/ai-cleanup`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("cleanup failed");
      setProposal(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function accept() {
    if (!proposal) return;
    sendOutcome("cleanup_accepted", sessionId, proposal, currentParams);
    onApply(proposal.params);
    setProposal(null);
  }

  function reject() {
    if (!proposal) return;
    sendOutcome("cleanup_rejected", sessionId, proposal, currentParams);
    setProposal(null);
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <button
        type="button"
        onClick={propose}
        disabled={loading || busy}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {loading ? "Reviewing your performance…" : "Looks wrong? Fix it with AI"}
      </button>

      {error ? (
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t generate a suggestion — try again in a moment.
        </p>
      ) : null}

      {proposal ? (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-xs">{proposal.explanation}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            confidence: {proposal.confidence}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={accept}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
            >
              <Check className="size-3" /> Apply
            </button>
            <button
              type="button"
              onClick={reject}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            >
              <X className="size-3" /> No thanks
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
