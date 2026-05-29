"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Check, Pencil, AlertTriangle } from "lucide-react";

interface Props {
  captureId: string;
  initialNotes: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Auto-saving notes field with a debounced PATCH to /api/monitor/captures/[id].
 * Notes are user-scoped (RLS on the table), no XSS surface since we render
 * the field as plain text only — Markdown deliberately avoided to keep the
 * surface narrow.
 */
export function CaptureNotesEditor({ captureId, initialNotes }: Props) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNotes ?? "");

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function scheduleSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void save(next); }, 700);
  }

  async function save(payload: string) {
    if (payload === lastSavedRef.current) {
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
      return;
    }
    setState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/monitor/captures/${captureId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: payload.length > 0 ? payload : null }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      lastSavedRef.current = payload;
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("error");
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Pencil className="size-3.5 text-muted-foreground" />
          Notes
        </h2>
        <SaveBadge state={state} error={error} />
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          scheduleSave(e.target.value);
        }}
        placeholder={
          "What were you testing? What broke?\nWhy is this capture worth keeping?"
        }
        rows={4}
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <p className="mt-1.5 text-[10px] text-muted-foreground/70">
        Saves automatically · **bold** · *italic* · `code` · [link](url) · max 8 000 chars
      </p>
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
  return <span className="font-mono text-[10px] text-muted-foreground/60">idle</span>;
}
