"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

interface Props {
  id: string;
  name: string;
}

export function DeleteCaptureButton({ id, name }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Delete capture "${name}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/monitor/captures/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="flex items-center gap-1 rounded-md border border-border bg-card/50 px-2 py-1.5 text-xs text-muted-foreground hover:border-red-400/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
      title="Delete"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
    </button>
  );
}
