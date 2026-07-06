"use client";

import { useCallback, useImperativeHandle, useState } from "react";
import type { Ref } from "react";
import { Loader2 } from "lucide-react";
import type { SampleWithVibes } from "@/lib/db/queries/samples";
import type { CapturedTake } from "@/hooks/use-microphone-record";
import { Editor, type EditorTake } from "./editor";
import { RecordPanelInline } from "./record-panel-inline";

type SurfaceState =
  | { kind: "empty" }
  | { kind: "captured"; take: EditorTake }
  | { kind: "loaded"; sample: SampleWithVibes };

export interface EditorSurfaceHandle {
  /** Load an existing sample (or recording-as-sample) into the editor. */
  loadSample: (sample: SampleWithVibes) => void;
  /** Reset to the empty (record-first) state. */
  reset: () => void;
  /** Inspect the current state — used by parents to confirm-on-swap. */
  getKind: () => SurfaceState["kind"];
}

interface Props {
  currentUserId: string;
  /** Optional ref so parent (workshop) can imperatively load a row on tile click. */
  surfaceRef?: Ref<EditorSurfaceHandle | null>;
  /** Called after a save completes — parent should refresh the workshop floor. */
  onSampleSaved?: (newSampleId: string) => void;
}

function takeFromCaptured(take: CapturedTake): EditorTake {
  return {
    wavBlob: take.wavBlob,
    audioBuffer: take.audioBuffer,
    durationSec: take.durationSec,
    sampleRate: take.audioBuffer.sampleRate,
    peaks: take.peaks,
  };
}

export function EditorSurface({
  currentUserId,
  surfaceRef,
  onSampleSaved,
}: Props) {
  const [state, setState] = useState<SurfaceState>({ kind: "empty" });

  const loadSample = useCallback((sample: SampleWithVibes) => {
    setState({ kind: "loaded", sample });
  }, []);

  const reset = useCallback(() => {
    setState({ kind: "empty" });
  }, []);

  useImperativeHandle(
    surfaceRef,
    () => ({
      loadSample,
      reset,
      getKind: () => state.kind,
    }),
    [loadSample, reset, state.kind],
  );

  const handleTakeCaptured = useCallback((take: CapturedTake) => {
    setState({ kind: "captured", take: takeFromCaptured(take) });
  }, []);

  const handleSaved = useCallback(
    (newSampleId: string) => {
      onSampleSaved?.(newSampleId);
      // Stay in loaded mode with the freshly-saved sample. The parent will
      // pass us the full row via loadSample on the next render once the
      // workshop floor refreshes; until then keep the editor mounted with
      // the in-memory take so the user sees no flash.
    },
    [onSampleSaved],
  );

  if (state.kind === "empty") {
    return <RecordPanelInline onTakeCaptured={handleTakeCaptured} />;
  }

  if (state.kind === "captured") {
    // Force remount when a new take arrives so the reducer/undo stack reset.
    return (
      <Editor
        key={`take-${state.take.audioBuffer.length}`}
        mode="transient"
        embedded
        currentUserId={currentUserId}
        take={state.take}
        onSaved={handleSaved}
        onDiscard={reset}
      />
    );
  }

  // loaded
  return (
    <Editor
      key={`sample-${state.sample.id}`}
      mode="persistent"
      embedded
      currentUserId={currentUserId}
      sample={state.sample}
      onSaved={handleSaved}
    />
  );
}

/**
 * A small overlay shown by the parent workshop while it's awaiting the
 * server action that fetches a sample for inline load. Kept here so the
 * surface and its loading affordance live together.
 */
export function EditorSurfaceLoadingOverlay() {
  return (
    <div className="border border-[color:var(--wb-line-soft)] bg-[color:var(--ink-900)] py-12 flex items-center justify-center gap-2 text-[color:var(--ink-500)] workbench-label">
      <Loader2 className="size-3.5 animate-spin" />
      loading sample…
    </div>
  );
}
