"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import * as Tone from "tone";
import { WaveformCanvas, type WaveformCanvasHandle } from "./waveform-canvas";
import { EffectChain } from "./effect-chain";
import { TransportBar } from "./transport-bar";
import { defaultChain, type EffectNode } from "@/lib/audio/editor-types";
import { playRealtime, type RealtimeController } from "@/lib/audio/tone-chain";
import { formatDuration, formatSampleId, formatTimecode } from "@/lib/sample-editor/format";
import { findNearestZeroCrossing } from "@/lib/audio/zero-crossing";
import type { SampleWithVibes } from "@/lib/db/queries/samples";

interface Props {
  sample: SampleWithVibes;
  currentUserId: string;
}

// ─── reducer ──────────────────────────────────────────────────────────────

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

// ─── helpers ──────────────────────────────────────────────────────────────

function getTrimBounds(
  chain: EffectNode[],
  fallbackDuration: number,
): { start: number; end: number } {
  const trim = chain.find((n) => n.kind === "trim");
  if (trim?.kind === "trim" && trim.enabled) {
    return { start: trim.startSec, end: trim.endSec };
  }
  return { start: 0, end: fallbackDuration };
}

// ─── component ────────────────────────────────────────────────────────────

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

  // ─── transport state ────────────────────────────────────────────────────

  const [isPlaying, setIsPlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [loop, setLoop] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [reverbBusy, setReverbBusy] = useState(false);
  const [analyser, setAnalyser] = useState<Tone.Analyser | null>(null);

  const controllerRef = useRef<RealtimeController | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  const playheadStartRef = useRef<number>(0);
  const abortTokenRef = useRef<object>({});
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const waveformRef = useRef<WaveformCanvasHandle>(null);
  const reverbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── decode WAV once ────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function decode() {
      try {
        const res = await fetch(sample.blob_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  // ─── shift-held tracking (zero-crossing snap) ───────────────────────────

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

  // ─── chain derivations ──────────────────────────────────────────────────

  const trimIndex = state.chain.findIndex((n) => n.kind === "trim");
  const trimNode =
    trimIndex >= 0 ? (state.chain[trimIndex] as Extract<EffectNode, { kind: "trim" }>) : null;

  const { start: trimStart, end: trimEnd } = useMemo(
    () => getTrimBounds(state.chain, duration),
    [state.chain, duration],
  );
  const trimmedDuration = Math.max(0, trimEnd - trimStart);

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

  // ─── effect-chain node updates (with reverb debounce) ───────────────────

  const handleNodeChange = useCallback(
    (index: number, node: EffectNode) => {
      dispatch({ type: "SET_EFFECT", index, node });
      if (node.kind === "reverb") {
        setReverbBusy(true);
        if (reverbDebounceRef.current) clearTimeout(reverbDebounceRef.current);
        reverbDebounceRef.current = setTimeout(() => setReverbBusy(false), 300);
      }
    },
    [],
  );

  // ─── rAF playhead loop ──────────────────────────────────────────────────

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startRaf = useCallback(
    (playheadStart: number, regionStart: number, regionEnd: number, looping: boolean) => {
      audioStartTimeRef.current = Tone.getContext().currentTime;
      playheadStartRef.current = playheadStart;
      const regionDuration = Math.max(0.001, regionEnd - regionStart);

      function tick() {
        const elapsed = Tone.getContext().currentTime - audioStartTimeRef.current;
        const raw = playheadStart + elapsed;
        const clamped = looping
          ? regionStart + ((raw - regionStart) % regionDuration)
          : Math.min(raw, regionEnd);

        waveformRef.current?.setPlayhead(clamped);
        if (timecodeRef.current) {
          timecodeRef.current.textContent = formatTimecode(clamped);
        }

        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [],
  );

  // ─── play / stop handlers ───────────────────────────────────────────────

  const resetTimecodeDisplay = useCallback((sec: number) => {
    waveformRef.current?.setPlayhead(sec);
    if (timecodeRef.current) timecodeRef.current.textContent = formatTimecode(sec);
  }, []);

  const handleStop = useCallback(() => {
    abortTokenRef.current = {}; // invalidate any in-flight play
    controllerRef.current?.stop();
    controllerRef.current = null;
    stopRaf();
    setIsPlaying(false);
    setIsStarting(false);
    setAnalyser(null);
    resetTimecodeDisplay(trimStart);
  }, [stopRaf, resetTimecodeDisplay, trimStart]);

  const handlePlay = useCallback(
    async (startAt?: number) => {
      if (!audioBuffer) return;
      if (isStarting) return;

      const token = {};
      abortTokenRef.current = token;

      controllerRef.current?.stop();
      controllerRef.current = null;
      stopRaf();

      const offset = startAt ?? trimStart;
      setIsStarting(true);

      let ctrl: RealtimeController;
      try {
        ctrl = await playRealtime(audioBuffer, state.chain, {
          bypass,
          loop,
          startAt: offset,
        });
      } catch (err) {
        console.error("playRealtime failed", err);
        if (abortTokenRef.current === token) setIsStarting(false);
        return;
      }

      // Stale check — user may have stopped while awaiting reverb.ready
      if (abortTokenRef.current !== token) {
        ctrl.stop();
        return;
      }

      controllerRef.current = ctrl;
      setAnalyser(ctrl.analyser);

      // Override onended to sync React state when playback finishes naturally
      ctrl.source.onended = () => {
        if (abortTokenRef.current !== token) return;
        ctrl.stop();
        stopRaf();
        setIsPlaying(false);
        setIsStarting(false);
        setAnalyser(null);
        controllerRef.current = null;
        resetTimecodeDisplay(loop ? trimStart : trimEnd);
      };

      setIsStarting(false);
      setIsPlaying(true);
      startRaf(offset, trimStart, trimEnd, loop);
    },
    [audioBuffer, isStarting, stopRaf, trimStart, trimEnd, bypass, loop, state.chain, startRaf, resetTimecodeDisplay],
  );

  const handlePlayToggle = useCallback(() => {
    if (isPlaying) handleStop();
    else void handlePlay();
  }, [isPlaying, handlePlay, handleStop]);

  const handleBypassToggle = useCallback(() => {
    const wasPlaying = isPlaying;
    let currentHead = trimStart;
    if (wasPlaying) {
      currentHead =
        playheadStartRef.current +
        (Tone.getContext().currentTime - audioStartTimeRef.current);
    }
    setBypass((v) => !v);
    if (wasPlaying) {
      handleStop();
      setTimeout(() => {
        void handlePlay(currentHead);
      }, 10);
    }
  }, [isPlaying, trimStart, handleStop, handlePlay]);

  const handleLoopToggle = useCallback(() => {
    setLoop((v) => !v);
  }, []);

  // ─── unmount cleanup ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortTokenRef.current = {};
      controllerRef.current?.stop();
      controllerRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (reverbDebounceRef.current) clearTimeout(reverbDebounceRef.current);
    };
  }, []);

  // ─── keyboard shortcuts ─────────────────────────────────────────────────

  // Capture latest handlers in refs so the keydown effect doesn't need to
  // re-register on every render.
  const handlersRef = useRef({
    handlePlayToggle,
    handleStop,
    handleBypassToggle,
    handleLoopToggle,
  });
  useEffect(() => {
    handlersRef.current = {
      handlePlayToggle,
      handleStop,
      handleBypassToggle,
      handleLoopToggle,
    };
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;

      const isMeta = e.metaKey || e.ctrlKey;

      if (e.code === "Space") {
        e.preventDefault();
        handlersRef.current.handlePlayToggle();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        handlersRef.current.handleLoopToggle();
        return;
      }
      if (e.key === "a" && !isMeta && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.handleBypassToggle();
        return;
      }
      if (e.key === "z" && isMeta && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
        return;
      }
      if (e.key === "z" && isMeta && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }
      // [ and ] — set trim in/out to current playhead (only while playing)
      if ((e.key === "[" || e.key === "]") && controllerRef.current) {
        e.preventDefault();
        const head =
          playheadStartRef.current +
          (Tone.getContext().currentTime - audioStartTimeRef.current);
        if (trimIndex >= 0 && trimNode) {
          const patched: EffectNode =
            e.key === "["
              ? { ...trimNode, enabled: true, startSec: Math.min(head, trimNode.endSec - 0.01) }
              : { ...trimNode, enabled: true, endSec: Math.max(head, trimNode.startSec + 0.01) };
          dispatch({ type: "SET_EFFECT", index: trimIndex, node: patched });
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trimIndex, trimNode]);

  // ─── render ─────────────────────────────────────────────────────────────

  const peaks = Array.isArray(sample.waveform_peaks) ? (sample.waveform_peaks as number[]) : [];
  const isOwner = false; // Phase 6
  void currentUserId;

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
              {sample.family && <span className="workbench-label">{sample.family}</span>}
            </div>
            <h1 className="workbench-heading text-3xl">
              {sample.root_note
                ? `${sample.family ?? "sample"} · ${sample.root_note.toLowerCase()}`
                : sample.family ?? "untitled"}
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
          ref={waveformRef}
          peaks={peaks}
          durationSec={duration}
          trimStart={trimStart}
          trimEnd={trimEnd}
          onTrimChange={handleTrimChange}
        />

        {/* Transport strip */}
        <TransportBar
          ref={timecodeRef}
          isPlaying={isPlaying}
          isStarting={isStarting}
          disabled={!audioBuffer}
          loop={loop}
          bypass={bypass}
          analyser={analyser}
          onPlayToggle={handlePlayToggle}
          onLoopToggle={handleLoopToggle}
          onBypassToggle={handleBypassToggle}
        />

        {/* Signal chain — horizontal pedalboard */}
        <section className="space-y-2">
          <h2 className="workbench-label">chain</h2>
          <EffectChain
            chain={state.chain}
            onNodeChange={handleNodeChange}
            reverbBusy={reverbBusy}
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
