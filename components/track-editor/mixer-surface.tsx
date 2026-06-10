"use client";

/**
 * Track editor (mix phase): the stems of one looper session through
 * channel strips — persisted volume/pan/mute/solo + per-channel EffectNode
 * chains — phase-locked playback, and offline mixdown back into the library.
 *
 * Mix state lives in React (the saved/dirty document); the engine mirrors it
 * via ramped updates. Trim/fade entries are intentionally absent from
 * channel chains — they're source-level concepts that mixer channels ignore.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createMixEngine, type MixEngine, type MixStem } from "@/lib/audio/mix-engine";
import { renderMixdown } from "@/lib/audio/mix-render";
import { encodeWav } from "@/lib/audio/wav-encoder";
import { computePeaksFromBuffer } from "@/lib/audio/compute-peaks";
import {
  arrangementLengthSec,
  defaultArrangement,
  defaultChannelSpec,
  DEFAULT_MASTER,
  type Arrangement,
  type MixChannelSpec,
  type SessionMixDoc,
} from "@/lib/audio/mix-types";
import type { EffectNode } from "@/lib/audio/editor-types";
import { saveSessionMix } from "@/app/(dashboard)/tracks/actions";
import { useAudioTakeover } from "@/hooks/use-audio-takeover";
import { ChannelStrip } from "./channel-strip";
import { TimelineCanvas } from "./timeline-canvas";
import { EffectChain } from "@/components/sample-editor/effect-chain";
import { PeakMeter } from "@/components/sample-editor/peak-meter";
import { LinearSlider } from "@/components/sample-editor/primitives/linear-slider";

export interface MixerStemInput {
  id: string;
  title: string;
  url: string;
  durationSec: number;
  peaks: number[] | null;
}

export interface MixerSurfaceProps {
  sessionId: string;
  sessionTitle: string;
  sessionBpm: number | null;
  stems: MixerStemInput[];
  initialMix: SessionMixDoc | null;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec % 60).toFixed(1).padStart(4, "0")}`;
}

export function MixerSurface({ sessionId, sessionTitle, sessionBpm, stems, initialMix }: MixerSurfaceProps) {
  useAudioTakeover();

  const [doc, setDoc] = useState<SessionMixDoc>(() => {
    const base = initialMix ?? { name: "Mix", channels: [], master: { ...DEFAULT_MASTER } };
    // Reconcile against the actual stems: keep saved specs, add new stems.
    const channels = stems.map(
      (s) =>
        base.channels.find((c) => c.recordingId === s.id) ??
        defaultChannelSpec(s.id, s.title),
    );
    return { ...base, channels };
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fxOpenFor, setFxOpenFor] = useState<string | null>(null);
  const [mode, setMode] = useState<"mixer" | "arrange">("mixer");
  const [arrangement, setArrangement] = useState<Arrangement>(
    () => initialMix?.arrangement ?? defaultArrangement(stems, sessionBpm),
  );
  const arrangementRef = useRef(arrangement);
  useEffect(() => { arrangementRef.current = arrangement; }, [arrangement]);
  const playheadRef = useRef<number | null>(null);
  const [engine, setEngine] = useState<MixEngine | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const buffersRef = useRef<MixStem[]>([]);
  const docRef = useRef(doc);
  useEffect(() => { docRef.current = doc; }, [doc]);
  const fullDoc = useCallback(
    () => ({ ...docRef.current, arrangement: arrangementRef.current }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Decode all stems once, then build the engine from the saved mix.
  useEffect(() => {
    let cancelled = false;
    let built: MixEngine | null = null;
    (async () => {
      try {
        const AudioCtx = window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const decoded: MixStem[] = await Promise.all(
          stems.map(async (s) => {
            const res = await fetch(s.url);
            if (!res.ok) throw new Error(`HTTP ${res.status} on "${s.title}"`);
            const bytes = await res.arrayBuffer();
            return { recordingId: s.id, buffer: await ctx.decodeAudioData(bytes) };
          }),
        );
        await ctx.close().catch(() => {});
        if (cancelled) return;
        buffersRef.current = decoded;
        built = await createMixEngine(decoded, docRef.current);
        if (cancelled) { built.dispose(); return; }
        setEngine(built);
      } catch (err) {
        if (!cancelled) {
          setEngineError(err instanceof Error ? err.message : "failed to load stems");
        }
      }
    })();
    return () => {
      cancelled = true;
      built?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Dev-only handle for the headless verify harness (verify-track-mixer.mjs):
  // channel loudness has no DOM proxy, so the script reads analysers directly.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !engine) return;
    const w = window as unknown as { __mixEngine?: MixEngine };
    w.__mixEngine = engine;
    return () => { delete w.__mixEngine; };
  }, [engine]);

  const timeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const tick = () => {
      const pos = engine.position();
      const total = modeRef.current === "arrange"
        ? arrangementLengthSec(arrangementRef.current)
        : engine.durationSec;
      if (timeRef.current) {
        timeRef.current.textContent = `${fmt(pos)} / ${fmt(total)}`;
      }
      playheadRef.current = engine.isPlaying() ? pos : null;
      // Arrangement playback self-stops at the end — mirror into the button.
      setPlaying((prev) => (prev === engine.isPlaying() ? prev : engine.isPlaying()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const patchChannel = useCallback(
    (recordingId: string, patch: Partial<MixChannelSpec>) => {
      setDoc((prev) => {
        const channels = prev.channels.map((c) =>
          c.recordingId === recordingId ? { ...c, ...patch } : c,
        );
        const next = { ...prev, channels };
        const spec = channels.find((c) => c.recordingId === recordingId);
        if (spec) engine?.applyChannel(recordingId, spec, channels);
        return next;
      });
      setDirty(true);
    },
    [engine],
  );

  const patchChain = useCallback(
    (recordingId: string, chain: EffectNode[]) => {
      setDoc((prev) => ({
        ...prev,
        channels: prev.channels.map((c) =>
          c.recordingId === recordingId ? { ...c, chain } : c,
        ),
      }));
      void engine?.updateChainFor(recordingId, chain);
      setDirty(true);
    },
    [engine],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    const result = await saveSessionMix(sessionId, fullDoc());
    setSaving(false);
    if ("error" in result) setToast(`save failed — ${result.error}`);
    else {
      setDirty(false);
      setToast("mix saved");
    }
  }, [sessionId, fullDoc]);

  const handleMixdown = useCallback(async () => {
    if (rendering || buffersRef.current.length === 0) return;
    setRendering(true);
    engine?.stop();
    setPlaying(false);
    try {
      const rendered = await renderMixdown(
        buffersRef.current,
        docRef.current,
        modeRef.current === "arrange" ? arrangementRef.current : null,
      );
      const wavBytes = encodeWav(rendered);
      const peaks = computePeaksFromBuffer(rendered, 200);
      const form = new FormData();
      form.append("wav", new Blob([wavBytes], { type: "audio/wav" }));
      form.append("name", `${sessionTitle} — ${docRef.current.name}`);
      form.append("durationSec", String(rendered.duration));
      form.append("sampleRate", String(rendered.sampleRate));
      form.append("waveformPeaks", JSON.stringify(peaks));
      const res = await fetch(`/api/sessions/${sessionId}/mixdown`, {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setToast("mixdown saved to recordings");
    } catch (err) {
      setToast(`mixdown failed — ${err instanceof Error ? err.message : "render error"}`);
    } finally {
      setRendering(false);
    }
  }, [engine, rendering, sessionId, sessionTitle]);

  const fxChannel = doc.channels.find((c) => c.recordingId === fxOpenFor);
  const maxStemDur = stems.reduce((m, s) => Math.max(m, s.durationSec), 0);

  return (
    <div className="workbench -m-6 min-h-[calc(100vh-3.5rem)] space-y-5 p-8">
      <header className="flex flex-wrap items-center gap-4">
        <Link
          href="/recordings"
          className="workbench-label flex items-center gap-1.5 text-[color:var(--ink-500)] hover:text-[color:var(--ink-300)] transition-colors"
        >
          <ArrowLeft className="size-3.5" /> recordings
        </Link>
        <h1 className="workbench-label text-base text-[color:var(--ink-300)]">
          mix · <span className="text-[color:var(--wb-amber)]">{sessionTitle}</span>
        </h1>
        <div className="flex items-center gap-1 border border-[color:var(--wb-line)] px-1 py-0.5">
          {(["mixer", "arrange"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`workbench-label px-2 py-1 transition-colors ${
                mode === m ? "text-[color:var(--wb-amber)]" : "text-[color:var(--ink-500)] hover:text-[color:var(--ink-300)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && !saving ? (
            <span className="workbench-readout text-[10px] text-[color:var(--wb-amber-dim)] lowercase">
              • unsaved changes
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="workbench-label border border-[color:var(--wb-amber-dim)] px-3 py-1.5 text-[color:var(--wb-amber)] hover:bg-[color:var(--wb-amber-glow)] transition-colors disabled:opacity-40"
          >
            {saving ? "saving…" : "save mix"}
          </button>
          <button
            type="button"
            onClick={() => void handleMixdown()}
            disabled={rendering || !engine}
            className="workbench-label flex items-center gap-1.5 border border-[color:var(--wb-line)] px-3 py-1.5 hover:border-[color:var(--ink-500)] transition-colors disabled:opacity-40"
          >
            {rendering ? <Loader2 className="size-3 animate-spin" /> : null}
            {rendering ? "rendering…" : "export mixdown"}
          </button>
        </div>
      </header>

      {engineError ? (
        <p role="alert" className="workbench-readout border border-[color:var(--wb-oxide)] px-3 py-2 text-xs text-[color:var(--wb-oxide)] lowercase">
          couldn&apos;t load stems — {engineError}
        </p>
      ) : null}

      {/* Transport + master */}
      <div className="flex flex-wrap items-center gap-5 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (!engine) return;
            if (playing) {
              engine.stop();
              setPlaying(false);
            } else if (mode === "arrange") {
              void engine.playArrangement(arrangementRef.current).then(() => setPlaying(true));
            } else {
              void engine.play().then(() => setPlaying(true));
            }
          }}
          disabled={!engine}
          aria-label={playing ? "stop session playback" : "play session"}
          className="workbench-label min-w-[82px] border border-[color:var(--wb-amber-dim)] px-3 py-1.5 text-left text-[color:var(--wb-amber)] hover:bg-[color:var(--wb-amber-glow)] transition-colors disabled:opacity-40 tabular-nums"
        >
          {playing ? "■ stop" : "▶ play"}
        </button>
        <span ref={timeRef} className="workbench-readout text-sm text-[color:var(--ink-300)] tabular-nums">
          0:00.0 / {fmt(maxStemDur)}
        </span>
        <span className="workbench-readout text-[10px] text-[color:var(--ink-600)] lowercase">
          {engine ? `${stems.length} stems, phase-locked` : stems.length > 0 ? "decoding stems…" : "no stems in this session"}
        </span>
        <div className="ml-auto flex items-end gap-3">
          <LinearSlider
            value={doc.master.volume}
            min={0}
            max={1.5}
            step={0.01}
            label="master"
            width={130}
            onChange={(v) => {
              setDoc((prev) => ({ ...prev, master: { ...prev.master, volume: v } }));
              engine?.setMasterVolume(v);
              setDirty(true);
            }}
          />
          {engine ? <PeakMeter analyser={engine.masterAnalyser} height={40} /> : null}
        </div>
      </div>

      {mode === "arrange" ? (
        <TimelineCanvas
          lanes={stems.map((s) => ({
            id: s.id,
            label: s.title,
            durationSec: s.durationSec,
            peaks: s.peaks,
          }))}
          arrangement={arrangement}
          onChange={(arr, commit) => {
            setArrangement(arr);
            if (commit) setDirty(true);
          }}
          playheadRef={playheadRef}
        />
      ) : null}

      {/* Channel strips */}
      <div className="space-y-2">
        {doc.channels.map((spec) => (
          <div key={spec.recordingId} className="space-y-2">
            <ChannelStrip
              spec={spec}
              analyser={engine?.channelAnalyser(spec.recordingId) ?? null}
              fxOpen={fxOpenFor === spec.recordingId}
              onChange={(patch) => patchChannel(spec.recordingId, patch)}
              onToggleFx={() =>
                setFxOpenFor((cur) => (cur === spec.recordingId ? null : spec.recordingId))
              }
            />
            {fxOpenFor === spec.recordingId && fxChannel ? (
              <div className="border border-[color:var(--wb-line-soft)] bg-[color:var(--ink-900)] p-3">
                <EffectChain
                  chain={fxChannel.chain}
                  durationSec={maxStemDur}
                  onNodeChange={(index, node) => {
                    const chain = [...fxChannel.chain];
                    chain[index] = node;
                    patchChain(spec.recordingId, chain);
                  }}
                  onRemove={(index) =>
                    patchChain(spec.recordingId, fxChannel.chain.filter((_, i) => i !== index))
                  }
                  onAdd={(node) => patchChain(spec.recordingId, [...fxChannel.chain, node])}
                  onReorder={(from, to) => {
                    const chain = [...fxChannel.chain];
                    const [moved] = chain.splice(from, 1);
                    chain.splice(to, 0, moved);
                    patchChain(spec.recordingId, chain);
                  }}
                  reverbBusy={false}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-6 top-6 z-50 border border-[color:var(--wb-amber)] bg-[color:var(--ink-800)] px-4 py-3 workbench-readout text-xs text-[color:var(--wb-amber)] lowercase"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
