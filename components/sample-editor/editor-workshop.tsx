"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import type {
  DraftRow,
  EditLogRow,
  UserSampleRow,
} from "@/lib/db/queries/sample-editor";
import { loadSampleForEditor } from "@/app/(dashboard)/sample-editor/actions";
import { EditorSurface, type EditorSurfaceHandle } from "./editor-surface";
import { DraftsList } from "./drafts-list";
import { SamplesGrid } from "./samples-grid";
import { RecentEditsLog } from "./recent-edits-log";

interface Props {
  currentUserId: string;
  drafts: DraftRow[];
  samples: UserSampleRow[];
  edits: EditLogRow[];
}

export function EditorWorkshop({
  currentUserId,
  drafts,
  samples,
  edits,
}: Props) {
  const router = useRouter();
  const surfaceRef = useRef<EditorSurfaceHandle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleLoadById = useCallback(
    (id: string) => {
      setLoadError(null);
      startTransition(async () => {
        try {
          const sample = await loadSampleForEditor(id);
          if (!sample) {
            setLoadError(
              "couldn't find that sample — it may have been deleted.",
            );
            return;
          }
          surfaceRef.current?.loadSample(sample);
          // Scroll to top so the loaded editor is visible.
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : "load failed");
        }
      });
    },
    [],
  );

  const handleSampleSaved = useCallback(() => {
    // Pull a fresh server render of the workshop floor (the new sample shows
    // up in your samples grid). The editor surface keeps its in-memory state.
    router.refresh();
  }, [router]);

  const draftCount = drafts.length;
  const draftHeader =
    draftCount === 0
      ? "drafts · no recordings awaiting"
      : `drafts · ${draftCount} ${draftCount === 1 ? "recording" : "recordings"} awaiting`;

  return (
    <div className="space-y-12">
      {/* ─── workbench (above the fold) ──────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="workbench-label">workbench</h2>
          {pending && (
            <span className="inline-flex items-center gap-1.5 workbench-readout text-[10px] text-[color:var(--ink-500)] lowercase">
              <Loader2 className="size-3 animate-spin" />
              loading sample…
            </span>
          )}
        </div>
        <EditorSurface
          surfaceRef={surfaceRef}
          currentUserId={currentUserId}
          onSampleSaved={handleSampleSaved}
        />
        {loadError && (
          <div className="flex items-center gap-2 text-xs text-[color:var(--wb-oxide)] lowercase">
            <AlertCircle className="size-3.5 shrink-0" />
            {loadError}
          </div>
        )}
      </section>

      {/* ─── workshop floor (below the fold) ──────────────────────────────── */}
      <div className="space-y-10 pt-4 border-t border-[color:var(--wb-line-soft)]">
        <header className="space-y-1">
          <h2 className="workbench-heading text-2xl">workshop floor</h2>
          <p className="text-xs text-[color:var(--ink-500)] lowercase">
            tap any tile below to load it into the workbench above.
          </p>
        </header>

        <section className="space-y-3">
          <h3 className="workbench-label">{draftHeader}</h3>
          <DraftsList
            drafts={drafts}
            onSelect={(d) => handleLoadById(d.id)}
          />
        </section>

        <section className="space-y-3">
          <h3 className="workbench-label">your samples · saved to library</h3>
          <SamplesGrid
            samples={samples}
            onSelect={(s) => handleLoadById(s.id)}
          />
        </section>

        <section className="space-y-3">
          <h3 className="workbench-label">recent edits</h3>
          <RecentEditsLog
            edits={edits}
            onSelect={(e) => handleLoadById(e.id)}
          />
        </section>
      </div>
    </div>
  );
}
