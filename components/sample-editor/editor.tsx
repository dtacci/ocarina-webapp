"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WaveformCanvas } from "./waveform-canvas";
import { EffectChain } from "./effect-chain";
import { defaultChain, type EffectNode } from "@/lib/audio/editor-types";
import { formatDuration, formatSampleId, formatTimecode } from "@/lib/sample-editor/format";
import { findNearestZeroCrossing } from "@/lib/audio/zero-crossing";
import type { SampleWithVibes } from "@/lib/db/queries/samples";

interface Props {
  sample: SampleWithVibes;
  currentUserId: string;
}

interface EditorState {
  chain: EffectNode[];
  past: EffectNode[][];
  future: EffectNode[][];
}

type EditorAction =
  | { type: "SET_EFFECT"; index: number; node: EffectNode }
  | { type: "TOGGLE_EFFECT"; index: number }
  | { type: "REORDER_EFFECTS"; from: number; to: number }
  | { type: "ADD_EFFECT"; node: EffectNode }
  | { type: "REMOVE_EFFECT"; index: number }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; chain: EffectNode[] };

const UNDO_CAP = 50;

function pushPast(past: EffectNode[][], current: EffectNode[]): EffectNode[][] {
  const next = [...past, current];
  return next.length > UNDO_CAP ? next.slice(next.length - UNDO_CAP) : next;
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_EFFECT": {
      const nextChain = state.chain.map((n, i) => (i === action.index ? action.node : n));
      return { chain: nextChain, past: pushPast(state.past, state.chain), future: [] };
    }
    case "TOGGLE_EFFECT": {
      const nextChain = state.chain.map((n, i) =>
        i === action.index ? { ...n, enabled: !n.enabled } : n,
      );
      return { chain: nextChain, past: pushPast(state.past, state.chain), future: [] };
    }
    case "REORDER_EFFECTS": {
      const nextChain = [...state.chain];
      const [moved] = nextChain.splice(action.from, 1);
      nextChain.splice(action.to, 0, moved);
      return { chain: nextChain, past: pushPast(state.past, state.chain), future: [] };
    }
    case "ADD_EFFECT": {
      const nextChain = [...state.chain, action.node];
      return { chain: nextChain, past: pushPast(state.past, state.chain), future: [] };
    }
    case "REMOVE_EFFECT": {
      const nextChain = state.chain.filter((_, i) => i !== action.index);
      return { chain: nextChain, past: pushPast(state.past, state.chain), future: [] };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        chain: prev,
        past: state.past.slice(0, -1),
        future: [state.chain, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { chain: next, past: pushPast(state.past, state.chain), future: rest };
    }
    case "RESET": {
      return { chain: action.chain, past: pushPast(state.past, state.chain), future: [] };
    }
  }
}

export function Editor({ sample, currentUserId }: Props) {
  const duration = sample.duration_sec;
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    chain: defaultChain(duration),
    past: [],
    future: [],
  }));

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [bufferError, setBufferError] = useState<string | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Fetch + decode the WAV once on mount.
  useEffect(() => {
    let cancelled = false;

    async function decode() {
      try {
        const res = await fetch(sample.blob_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const buffer = await ctx.decodeAudioData(arrayBuffer);
        if (!cancelled) setAudioBuffer(buffer);
      } catch (err) {
        if (!cancelled) {
          setBufferError(err instanceof Error ? err.message : "decode failed");
        }
      }
    }

    decode();
    return () => {
      cancelled = true;
      audioContextRef.current?.close().catch(() => {
        // best-effort cleanup
      });
    };
  }, [sample.blob_url]);

  // Track Shift key for zero-crossing snap on region drag.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // Derive trim node for the waveform region.
  const trimIndex = state.chain.findIndex((n) => n.kind === "trim");
  const trimNode = trimIndex >= 0 ? (state.chain[trimIndex] as Extract<EffectNode, { kind: "trim" }>) : null;

  const handleTrimChange = useCallback(
    (start: number, end: number) => {
      if (trimIndex < 0 || !trimNode) return;
      let s = Math.max(0, Math.min(start, duration));
      let e = Math.max(s, Math.min(end, duration));

      if (shiftHeld && audioBuffer) {
        s = findNearestZeroCrossing(audioBuffer, 0, s);
        e = findNearestZeroCrossing(audioBuffer, 0, e);
      }

      dispatch({
        type: "SET_EFFECT",
        index: trimIndex,
        node: { ...trimNode, startSec: s, endSec: e },
      });
    },
    [trimIndex, trimNode, duration, shiftHeld, audioBuffer],
  );

  const peaks = Array.isArray(sample.waveform_peaks) ? (sample.waveform_peaks as number[]) : [];
  const isOwner = false; // placeholder; Phase 6 will look up sample owner for overwrite gating
  void currentUserId; // used in Phase 6

  const trimStart = trimNode?.startSec ?? 0;
  const trimEnd = trimNode?.endSec ?? duration;
  const trimmedDuration = Math.max(0, trimEnd - trimStart);

  return (
    <div className="workbench -m-6 min-h-[calc(100vh-3.5rem)] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-6">
          <div className="min-w-0 space-y-2">
            <Link
              href="/sample-editor"
              className="inline-flex items-center gap-1.5 text-xs text-[color:var(--ink-500)] hover:text-[color:var(--ink-300)] transition-colors lowercase"
            >
              <ArrowLeft className="size-3.5" />
              sample editor
            </Link>
            <div className="flex items-baseline gap-3">
              <span className="workbench-readout text-sm text-[color:var(--ink-300)]">
                {formatSampleId(sample.id)}
              </span>
              {sample.family && (
                <span className="workbench-label">{sample.family}</span>
              )}
            </div>
            <h1 className="workbench-heading text-3xl">
              {sample.root_note ? `${sample.family ?? "sample"} · ${sample.root_note.toLowerCase()}` : (sample.family ?? "untitled")}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => dispatch({ type: "RESET", chain: defaultChain(duration) })}
              className="workbench-label px-3 py-2 border border-[color:var(--wb-line)] hover:border-[color:var(--ink-500)] transition-colors"
            >
              revert
            </button>
            <button
              type="button"
              disabled={!isOwner}
              className="workbench-label px-3 py-2 border border-[color:var(--wb-line)] hover:border-[color:var(--wb-amber-dim)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={isOwner ? "save — overwrite this sample" : "save — only available on your own samples"}
            >
              save
            </button>
            <button
              type="button"
              className="workbench-label px-3 py-2 border border-[color:var(--wb-amber-dim)] text-[color:var(--wb-amber)] hover:bg-[color:var(--wb-amber-glow)] transition-colors"
            >
              save as new
            </button>
          </div>
        </header>

        {/* Readout row (above waveform) */}
        <div className="flex items-center gap-6 workbench-readout text-xs text-[color:var(--ink-500)]">
          <span>
            <span className="text-[color:var(--ink-300)] tabular-nums">{formatTimecode(trimStart)}</span>
            <span className="mx-1 text-[color:var(--ink-600)]">→</span>
            <span className="text-[color:var(--ink-300)] tabular-nums">{formatTimecode(trimEnd)}</span>
          </span>
          <span className="lowercase">
            duration <span className="text-[color:var(--ink-300)] tabular-nums">{formatDuration(trimmedDuration)}</span>
          </span>
          <span className="lowercase">
            sr <span className="text-[color:var(--ink-300)] tabular-nums">{sample.sample_rate}</span> hz
          </span>
          <span className="lowercase ml-auto">
            {audioBuffer
              ? "decoded"
              : bufferError
                ? <span className="text-[color:var(--wb-oxide)]">decode failed · {bufferError}</span>
                : "decoding…"}
          </span>
        </div>

        {/* Waveform */}
        <WaveformCanvas
          peaks={peaks}
          durationSec={duration}
          trimStart={trimStart}
          trimEnd={trimEnd}
          onTrimChange={handleTrimChange}
          playheadSec={0}
        />

        {/* Transport placeholder — wired in Phase 5 */}
        <section className="border border-[color:var(--wb-line-soft)] px-5 py-4 text-xs workbench-readout text-[color:var(--ink-500)] lowercase">
          transport — coming in phase 5
        </section>

        {/* Signal chain — horizontal pedalboard */}
        <section className="space-y-2">
          <h2 className="workbench-label">chain</h2>
          <EffectChain
            chain={state.chain}
            onNodeChange={(index, node) => dispatch({ type: "SET_EFFECT", index, node })}
          />
        </section>

        {/* Metadata placeholder — wired in Phase 6 */}
        <section className="border border-[color:var(--wb-line-soft)] px-5 py-4 text-xs workbench-readout text-[color:var(--ink-500)] lowercase">
          metadata — coming in phase 6
        </section>
      </div>
    </div>
  );
}
