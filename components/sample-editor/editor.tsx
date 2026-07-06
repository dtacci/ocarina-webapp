"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import * as Tone from "tone";
import { WaveformCanvas, type WaveformCanvasHandle } from "./waveform-canvas";
import { EffectChain } from "./effect-chain";
import { TransportBar } from "./transport-bar";
import { BakeOverlay, type BakeOverlayHandle } from "./bake-overlay";
import {
  MetadataPanel,
  type SampleCategory,
  type SampleFamily,
  type SampleMetadata,
} from "./metadata-panel";
import { defaultChain, type EffectNode } from "@/lib/audio/editor-types";
import { playRealtime, renderOffline, type RealtimeController } from "@/lib/audio/tone-chain";
import { encodeWav } from "@/lib/audio/wav-encoder";
import { computePeaksFromBuffer } from "@/lib/audio/compute-peaks";
import { formatDuration, formatSampleId, formatTimecode } from "@/lib/sample-editor/format";
import { findNearestZeroCrossing } from "@/lib/audio/zero-crossing";
import { revalidateSampleEditor } from "@/app/(dashboard)/sample-editor/actions";
import type { SampleWithVibes } from "@/lib/db/queries/samples";
import { useAudioTakeover } from "@/hooks/use-audio-takeover";

export interface EditorTake {
  wavBlob: Blob;
  audioBuffer: AudioBuffer;
  durationSec: number;
  sampleRate: number;
  peaks: number[];
}

interface EditorCommonProps {
  /**
   * Drop the page-takeover wrapper styling (`-m-6 min-h-[…] p-8`) when the
   * Editor is mounted inside a parent that already provides the workbench
   * scope and padding (e.g. <EditorSurface> on /sample-editor). Default false
   * preserves the standalone /sample-editor/[id] route layout.
   */
  embedded?: boolean;
}

export type EditorProps = EditorCommonProps &
  (
    | {
        mode: "persistent";
        sample: SampleWithVibes;
        currentUserId: string;
        /** When provided, called with the new sample id instead of router.push to /library. */
        onSaved?: (newSampleId: string) => void;
      }
    | {
        mode: "transient";
        currentUserId: string;
        take: EditorTake;
        /** When provided, called with the new sample id after the take is saved. */
        onSaved?: (newSampleId: string) => void;
        /** Discard the take and return to the empty state. */
        onDiscard?: () => void;
      }
  );

function transientToSample(take: EditorTake): SampleWithVibes {
  return {
    id: "",
    title: null,
    blob_url: "",
    mp3_blob_url: null,
    duration_sec: take.durationSec,
    sample_rate: take.sampleRate,
    root_note: null,
    root_freq: null,
    brightness: null,
    attack: null,
    sustain: null,
    texture: null,
    warmth: null,
    category: null,
    family: null,
    loopable: false,
    is_system: false,
    waveform_peaks: take.peaks,
    source_sample_id: null,
    edit_spec: null,
    user_id: null,
    vibes: [],
  };
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
      // No-op reorder shouldn't pollute undo stack.
      if (action.from === action.to) return state;
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

function initialMetadata(sample: SampleWithVibes): SampleMetadata {
  const validFamilies: SampleFamily[] = [
    "strings", "brass", "woodwind", "keys", "mallet",
    "drums", "guitar", "other_perc", "other", "fx",
  ];
  const validCategories: SampleCategory[] = ["acoustic", "percussion", "fx"];

  const family: SampleFamily | "" =
    sample.family && validFamilies.includes(sample.family as SampleFamily)
      ? (sample.family as SampleFamily)
      : "";
  const category: SampleCategory | "" =
    sample.category && validCategories.includes(sample.category as SampleCategory)
      ? (sample.category as SampleCategory)
      : "";

  return {
    name: sample.title?.trim() ?? "",
    family,
    category,
    rootNote: sample.root_note ?? "",
    brightness: sample.brightness ?? 5,
    attack: sample.attack ?? 5,
    sustain: sample.sustain ?? 5,
    texture: sample.texture ?? 5,
    warmth: sample.warmth ?? 5,
    vibes: sample.vibes ?? [],
    loopable: sample.loopable ?? false,
  };
}

// ─── component ────────────────────────────────────────────────────────────

export function Editor(props: EditorProps) {
  useAudioTakeover();

  const router = useRouter();
  const isTransient = props.mode === "transient";
  const embedded = props.embedded ?? false;
  const sample =
    props.mode === "persistent" ? props.sample : transientToSample(props.take);
  const onSaved = props.onSaved;
  const onDiscard = props.mode === "transient" ? props.onDiscard : undefined;
  const transientTake = props.mode === "transient" ? props.take : null;
  const currentUserId = props.currentUserId;

  const duration = sample.duration_sec;
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    chain: defaultChain(duration),
    past: [],
    future: [],
  }));

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(
    transientTake?.audioBuffer ?? null,
  );
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

  // ─── save / metadata state ──────────────────────────────────────────────

  const [metadata, setMetadata] = useState<SampleMetadata>(() => initialMetadata(sample));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const bakeRef = useRef<BakeOverlayHandle>(null);

  const handleMetadataChange = useCallback((patch: Partial<SampleMetadata>) => {
    setMetadata((m) => ({ ...m, ...patch }));
  }, []);

  // Auto-dismiss toast after 3s.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.kind === "success" ? 3000 : 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // ─── decode WAV once ────────────────────────────────────────────────────
  // In transient mode the AudioBuffer was provided by the caller (a
  // freshly-recorded take) — no fetch needed.

  useEffect(() => {
    if (isTransient) return;
    let cancelled = false;

    async function decode() {
      // System samples store device-relative paths ("samples/organized/…") —
      // their audio lives on the Pi, not on web storage. Fetching that path
      // would just 404 against the page origin; say so instead.
      if (!/^https?:\/\//.test(sample.blob_url)) {
        setBufferError("audio lives on the ocarina device, not editable on the web");
        return;
      }
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
  }, [isTransient, sample.blob_url]);

  // ─── shift-held tracking ────────────────────────────────────────────────

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

  const handleNodeChange = useCallback((index: number, node: EffectNode) => {
    dispatch({ type: "SET_EFFECT", index, node });
    if (node.kind === "reverb") {
      setReverbBusy(true);
      if (reverbDebounceRef.current) clearTimeout(reverbDebounceRef.current);
      reverbDebounceRef.current = setTimeout(() => setReverbBusy(false), 300);
    }
  }, []);

  const handleRemoveNode = useCallback((index: number) => {
    dispatch({ type: "REMOVE_EFFECT", index });
  }, []);

  const handleAddNode = useCallback((node: EffectNode) => {
    dispatch({ type: "ADD_EFFECT", node });
  }, []);

  const handleReorder = useCallback((from: number, to: number) => {
    dispatch({ type: "REORDER_EFFECTS", from, to });
  }, []);

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

  // ─── play / stop / bypass handlers ──────────────────────────────────────

  const resetTimecodeDisplay = useCallback((sec: number) => {
    waveformRef.current?.setPlayhead(sec);
    if (timecodeRef.current) timecodeRef.current.textContent = formatTimecode(sec);
  }, []);

  const handleStop = useCallback(() => {
    abortTokenRef.current = {};
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

      if (abortTokenRef.current !== token) {
        ctrl.stop();
        return;
      }

      controllerRef.current = ctrl;
      setAnalyser(ctrl.analyser);

      ctrl.onNaturalEnd(() => {
        if (abortTokenRef.current !== token) return;
        ctrl.stop();
        stopRaf();
        setIsPlaying(false);
        setIsStarting(false);
        setAnalyser(null);
        controllerRef.current = null;
        resetTimecodeDisplay(trimEnd);
      });

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

  // ─── save as new ────────────────────────────────────────────────────────

  const handleSaveAsNew = useCallback(async () => {
    if (!audioBuffer || saving) return;
    if (trimmedDuration < 0.1) {
      setToast({ kind: "error", text: "trim is too short — needs at least 100ms" });
      return;
    }

    // Stop any playback first — render needs a clean Tone graph
    handleStop();
    setSaving(true);
    setToast(null);

    // Estimate render duration ~= trimmed duration (Tone.Offline usually runs
    // at or faster than real-time for simple chains). We cap the animation
    // at 0.95 until finish() is called.
    const estimatedMs = Math.max(600, trimmedDuration * 1000);
    bakeRef.current?.start(estimatedMs);

    try {
      const rendered = await renderOffline(audioBuffer, state.chain);

      // Compute peaks from the rendered buffer for the library preview
      const peaks = computePeaksFromBuffer(rendered, 200);
      const wavBytes = encodeWav(rendered);

      const payload = {
        name: metadata.name.trim() || null,
        family: metadata.family || null,
        category: metadata.category || null,
        rootNote: metadata.rootNote || null,
        rootFreq: sample.root_freq ?? null,
        brightness: metadata.brightness,
        attack: metadata.attack,
        sustain: metadata.sustain,
        texture: metadata.texture,
        warmth: metadata.warmth,
        vibes: metadata.vibes,
        waveformPeaks: peaks,
        durationSec: rendered.duration,
        sampleRate: rendered.sampleRate,
        // Tempo rides through from bpm-tagged sources (looper stems, drum
        // loops, DJ mixes) so the baked sample stays beat-loopable on deck.
        bpm: sample.bpm ?? null,
        loopable: metadata.loopable,
      };

      // Transient takes (browser-recorded, no source sample row) save with an
      // empty sourceSampleId — the API now accepts this and stores null.
      const sourceSampleId = isTransient ? "" : sample.id;

      const form = new FormData();
      form.append("wav", new Blob([wavBytes], { type: "audio/wav" }));
      form.append("metadata", JSON.stringify(payload));
      form.append("editSpec", JSON.stringify({
        chain: state.chain,
        sourceSampleId: sourceSampleId || null,
      }));
      form.append("sourceSampleId", sourceSampleId);

      const res = await fetch("/api/samples/create", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "save failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const { id } = (await res.json()) as { id: string };

      await bakeRef.current?.finish();
      await revalidateSampleEditor();

      setToast({ kind: "success", text: `saved · ${formatSampleId(id, "SE")}` });

      // Give the toast a beat, then either hand control back to the parent
      // surface (workshop flow) or navigate to the library page (legacy).
      setTimeout(() => {
        if (onSaved) {
          onSaved(id);
        } else {
          router.push(`/library/${encodeURIComponent(id)}`);
        }
      }, 800);
    } catch (err) {
      bakeRef.current?.cancel();
      const msg = err instanceof Error ? err.message : "save failed";
      setToast({ kind: "error", text: msg });
      setSaving(false);
    }
  }, [audioBuffer, saving, handleStop, trimmedDuration, state.chain, metadata, sample.id, sample.root_freq, sample.bpm, isTransient, onSaved, router]);

  // ─── live chain updates during playback ─────────────────────────────────
  // When the user tweaks a knob or toggles an effect's LED while audio is
  // playing, push the new chain into the active controller so we hear the
  // change immediately. Param-only updates patch nodes in place; structural
  // changes (enabled flip, kind/length change) trigger a graph rebuild.

  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    void ctrl.updateChain(state.chain);
  }, [state.chain]);

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

  const handlersRef = useRef({
    handlePlayToggle,
    handleStop,
    handleBypassToggle,
    handleLoopToggle,
    handleSaveAsNew,
  });
  useEffect(() => {
    handlersRef.current = {
      handlePlayToggle,
      handleStop,
      handleBypassToggle,
      handleLoopToggle,
      handleSaveAsNew,
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
      if ((e.key === "s" || e.key === "S") && isMeta) {
        e.preventDefault();
        handlersRef.current.handleSaveAsNew();
        return;
      }
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
  void currentUserId; // v2: use for overwrite gating

  const sourceLineageId =
    typeof sample.source_sample_id === "string" && sample.source_sample_id.length > 0
      ? sample.source_sample_id
      : null;

  // "Dirty" = take is in-memory unsaved (transient) OR user has touched the
  // chain or renamed since the editor mounted (persistent). Drives the small
  // "unsaved" hint under the save button.
  const isDirty = isTransient || state.past.length > 0 || metadata.name.trim().length > 0;

  return (
    <div
      className={
        embedded
          ? "relative"
          : "workbench -m-6 min-h-[calc(100vh-3.5rem)] p-8 relative"
      }
      aria-busy={saving}
    >
      <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
        {/* Header */}
        <header className="flex items-start justify-between gap-6">
          <div className="min-w-0 space-y-2">
            {!isTransient && (
              <Link
                href="/sample-editor"
                className="inline-flex items-center gap-1.5 text-xs text-[color:var(--ink-500)] hover:text-[color:var(--ink-300)] transition-colors lowercase"
              >
                <ArrowLeft className="size-3.5" />
                sample editor
              </Link>
            )}
            {isTransient ? (
              <div className="flex items-baseline gap-3">
                <span className="workbench-label text-[color:var(--wb-amber)]">
                  • new take
                </span>
                <span className="workbench-readout text-xs text-[color:var(--ink-500)] lowercase">
                  unsaved
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-3">
                <span className="workbench-readout text-sm text-[color:var(--ink-300)]">
                  {formatSampleId(sample.id, sourceLineageId ? "SE" : "SMP")}
                </span>
                {sample.family && <span className="workbench-label">{sample.family}</span>}
              </div>
            )}
            {isTransient ? (
              <InlineEditableTitle
                value={metadata.name}
                placeholder="untitled take"
                onCommit={(name) => handleMetadataChange({ name })}
              />
            ) : (
              <InlineEditableTitle
                value={metadata.name || sample.title?.trim() || ""}
                placeholder={
                  sample.root_note
                    ? `${sample.family ?? "sample"} · ${sample.root_note.toLowerCase()}`
                    : sample.family ?? "untitled"
                }
                onCommit={(name) => handleMetadataChange({ name })}
              />
            )}
            {sourceLineageId && (
              <Link
                href={`/library/${encodeURIComponent(sourceLineageId)}`}
                className="inline-flex items-center gap-1.5 text-xs text-[color:var(--ink-500)] hover:text-[color:var(--wb-amber)] transition-colors lowercase"
              >
                ← forked from{" "}
                <span className="workbench-readout">{formatSampleId(sourceLineageId)}</span>
              </Link>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2">
              {isTransient && onDiscard && (
                <button
                  type="button"
                  onClick={onDiscard}
                  disabled={saving}
                  className="workbench-label px-3 py-2 border border-[color:var(--wb-line)] hover:border-[color:var(--wb-oxide)] hover:text-[color:var(--wb-oxide)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  discard take
                </button>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: "RESET", chain: defaultChain(duration) })}
                disabled={saving}
                className="workbench-label px-3 py-2 border border-[color:var(--wb-line)] hover:border-[color:var(--ink-500)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                revert
              </button>
              <button
                type="button"
                onClick={handleSaveAsNew}
                disabled={saving || !audioBuffer}
                className="workbench-label px-3 py-2 border border-[color:var(--wb-amber-dim)] text-[color:var(--wb-amber)] hover:bg-[color:var(--wb-amber-glow)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "saving…" : isTransient ? "save take" : "save as new"}
              </button>
            </div>
            {isDirty && !saving && (
              <span className="workbench-readout text-[10px] text-[color:var(--wb-amber-dim)] lowercase pr-1">
                • unsaved changes
              </span>
            )}
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

        {/* Waveform + bake overlay */}
        <div className="relative">
          <WaveformCanvas
            ref={waveformRef}
            peaks={peaks}
            durationSec={duration}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onTrimChange={handleTrimChange}
            onSeek={(t) => {
              if (!audioBuffer || saving) return;
              // Clamp to the kept region so clicks outside the trim handles
              // snap to the nearest boundary instead of trying to play silence.
              const clamped = Math.max(trimStart, Math.min(t, trimEnd));
              void handlePlay(clamped);
            }}
          />
          <BakeOverlay ref={bakeRef} />
        </div>

        {/* Transport strip */}
        <TransportBar
          ref={timecodeRef}
          isPlaying={isPlaying}
          isStarting={isStarting}
          disabled={!audioBuffer || saving}
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
            durationSec={duration}
            onNodeChange={handleNodeChange}
            onRemove={handleRemoveNode}
            onAdd={handleAddNode}
            onReorder={handleReorder}
            reverbBusy={reverbBusy}
          />
        </section>

        {/* Metadata */}
        <MetadataPanel metadata={metadata} onChange={handleMetadataChange} />

        {/* Keyboard hints — specimen-catalog footer */}
        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-4 border-t border-[color:var(--wb-line-soft)] workbench-readout text-[10px] text-[color:var(--ink-600)] lowercase">
          <KeyHint keys={["space"]} label="play / stop" />
          <KeyHint keys={["a"]} label="a / b" />
          <KeyHint keys={["/"]} label="loop" />
          <KeyHint keys={["[", "]"]} label="trim in / out" />
          <KeyHint keys={["⌘", "z"]} label="undo" />
          <KeyHint keys={["⌘", "⇧", "z"]} label="redo" />
          <KeyHint keys={["⌘", "s"]} label="save as new" />
          <KeyHint keys={["shift"]} label="snap to zero crossing" />
        </footer>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 right-6 z-50 border px-4 py-3 workbench-readout text-xs lowercase"
          style={{
            backgroundColor: "var(--ink-800)",
            borderColor: toast.kind === "success" ? "var(--wb-amber)" : "var(--wb-oxide)",
            color: toast.kind === "success" ? "var(--wb-amber)" : "var(--wb-oxide)",
            boxShadow: "0 8px 24px oklch(0 0 0 / 0.4)",
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function InlineEditableTitle({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder: string;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when the external value changes (e.g. metadata panel edit)
  // and we're not actively editing — render-phase pattern recommended over
  // useEffect-based prop→state mirroring.
  if (!editing && value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value);
  }

  // Autofocus + select-all when entering edit mode.
  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next !== value) onCommit(next);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={placeholder}
        maxLength={120}
        className="workbench-heading text-3xl bg-transparent border-b border-[color:var(--wb-amber-dim)] focus:border-[color:var(--wb-amber)] focus:outline-none w-full text-[color:var(--ink-200)] placeholder:text-[color:var(--ink-600)] lowercase"
      />
    );
  }

  const displayed = value.trim() || placeholder;
  const isPlaceholder = !value.trim();

  return (
    <h1
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      title="click to rename"
      className="workbench-heading text-3xl cursor-text border-b border-transparent hover:border-[color:var(--wb-line)] transition-colors w-fit max-w-full truncate"
      style={{ color: isPlaceholder ? "var(--ink-500)" : undefined }}
    >
      {displayed}
    </h1>
  );
}

function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="border border-[color:var(--wb-line)] bg-[color:var(--ink-900)] px-1.5 py-0.5 text-[9px] text-[color:var(--ink-300)] tabular-nums"
            style={{ minWidth: 18, textAlign: "center" }}
          >
            {k}
          </kbd>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}
