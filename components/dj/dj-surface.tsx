"use client";

/**
 * DJ mode — two decks, an equal-power crossfader, and the ocarina's physical
 * pots as control surface (via the high-rate "pots" stream + use-dj-hardware).
 *
 * Control-ownership rules:
 *  - Knobs/faders: React state is the source of truth, pushed into the engine.
 *  - Crossfader: two writers (slider drag + hardware pot). Pot events drive
 *    the engine directly at ~30 Hz (no setState) and a 10 Hz interval reflects
 *    the latest value back into the slider; dragging the slider suppresses pot
 *    input until 500 ms after release (last-writer-wins without fighting).
 *  - Transport readouts: rAF straight into the DOM (see DeckPanel).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { createDjEngine, type DjEngine } from "@/lib/audio/dj-engine";
import type { DjSource } from "@/lib/db/queries/dj";
import { useAudioTakeover } from "@/hooks/use-audio-takeover";
import { useDjHardware } from "@/hooks/use-dj-hardware";
import { DeckPanel } from "./deck";
import { Crossfader } from "./crossfader";
import { DeckSourceBrowser } from "./deck-source-browser";
import { PotMappingPanel } from "./pot-mapping-panel";
import { PeakMeter } from "@/components/sample-editor/peak-meter";
import { LinearSlider } from "@/components/sample-editor/primitives/linear-slider";

type DeckId = "a" | "b";

interface DeckTrackMeta {
  title: string | null;
  bpm: number | null;
  loading: boolean;
}

const EMPTY_META: DeckTrackMeta = { title: null, bpm: null, loading: false };

export function DjSurface({ sources }: { sources: DjSource[] }) {
  useAudioTakeover();

  const [engine, setEngine] = useState<DjEngine | null>(null);
  useEffect(() => {
    const e = createDjEngine();
    setEngine(e);
    return () => e.dispose();
  }, []);

  const [meta, setMeta] = useState<Record<DeckId, DeckTrackMeta>>({
    a: EMPTY_META,
    b: EMPTY_META,
  });
  const [browserFor, setBrowserFor] = useState<DeckId | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── crossfader: shared between slider and pot ───────────────────────────
  const [xfade, setXfade] = useState(0.5);
  const xfadeRef = useRef(0.5);
  const hwActiveUntilRef = useRef(0);
  const [hwActive, setHwActive] = useState(false);
  const [masterVol, setMasterVol] = useState(1);

  const engineRef = useRef<DjEngine | null>(null);
  useEffect(() => { engineRef.current = engine; }, [engine]);

  // Dev-only handle for the headless verify harness (scripts/verify-dj-mode.mjs):
  // loudness has no DOM proxy, so the script reads the deck analysers directly.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !engine) return;
    const w = window as unknown as { __djEngine?: DjEngine };
    w.__djEngine = engine;
    return () => { delete w.__djEngine; };
  }, [engine]);

  const hw = useDjHardware({
    onCrossfade: (v) => {
      engineRef.current?.setCrossfade(v);
      xfadeRef.current = v;
      hwActiveUntilRef.current = Date.now() + 400;
    },
    onMasterVolume: (v) => {
      engineRef.current?.setMasterVolume(v * 1.2);
      // Reflected into the slider by the same 10 Hz sync below.
    },
    onDeckFilter: (v) => {
      // Applies to the deck the crossfader currently favors.
      const deck = xfadeRef.current < 0.5 ? "a" : "b";
      engineRef.current?.decks[deck].setFilter(v * 2 - 1);
    },
  });

  // Reflect pot-driven crossfade into the slider at UI rate (not pot rate).
  useEffect(() => {
    const iv = setInterval(() => {
      setXfade((prev) =>
        Math.abs(prev - xfadeRef.current) > 0.004 ? xfadeRef.current : prev,
      );
      setHwActive(Date.now() < hwActiveUntilRef.current);
    }, 100);
    return () => clearInterval(iv);
  }, []);

  const handleSliderChange = useCallback((v: number) => {
    xfadeRef.current = v;
    setXfade(v);
    engineRef.current?.setCrossfade(v);
  }, []);

  // ── deck loading ─────────────────────────────────────────────────────────
  const decodeAndLoad = useCallback(
    async (deckId: DeckId, bytes: ArrayBuffer, title: string, bpm: number | null) => {
      const eng = engineRef.current;
      if (!eng) return;
      setLoadError(null);
      setMeta((m) => ({ ...m, [deckId]: { title: null, bpm: null, loading: true } }));
      try {
        await Tone.start(); // load is always a user gesture — unlock here too
        const buffer = await Tone.getContext().rawContext.decodeAudioData(bytes);
        eng.decks[deckId].load(buffer, { title, bpm });
        setMeta((m) => ({ ...m, [deckId]: { title, bpm, loading: false } }));
      } catch (err) {
        setMeta((m) => ({ ...m, [deckId]: EMPTY_META }));
        setLoadError(
          `couldn't load "${title}" — ${err instanceof Error ? err.message : "decode failed"}`,
        );
      }
    },
    [],
  );

  const loadSource = useCallback(
    async (deckId: DeckId, source: DjSource) => {
      setBrowserFor(null);
      try {
        const res = await fetch(source.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        await decodeAndLoad(deckId, bytes, source.title, source.bpm);
      } catch (err) {
        setMeta((m) => ({ ...m, [deckId]: EMPTY_META }));
        setLoadError(
          `couldn't fetch "${source.title}" — ${err instanceof Error ? err.message : "failed"}`,
        );
      }
    },
    [decodeAndLoad],
  );

  const loadFile = useCallback(
    async (deckId: DeckId, file: File) => {
      setBrowserFor(null);
      const bytes = await file.arrayBuffer();
      await decodeAndLoad(deckId, bytes, file.name.replace(/\.[^.]+$/, ""), null);
    },
    [decodeAndLoad],
  );

  return (
    <div className="workbench -m-6 min-h-[calc(100vh-3.5rem)] space-y-5 p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="workbench-label text-base text-[color:var(--ink-300)]">dj decks</h1>
        <p className="workbench-readout text-[10px] text-[color:var(--ink-600)] lowercase">
          load a track on each side · sweep the crossfader · map a hardware knob below
        </p>
      </header>

      {loadError ? (
        <p role="alert" className="workbench-readout border border-[color:var(--wb-oxide)] px-3 py-2 text-xs text-[color:var(--wb-oxide)] lowercase">
          {loadError}
        </p>
      ) : null}

      {engine ? (
        <>
          <div className="flex flex-wrap gap-5">
            <DeckPanel
              deck={engine.decks.a}
              label="A"
              trackTitle={meta.a.title}
              trackBpm={meta.a.bpm}
              loading={meta.a.loading}
              onRequestLoad={() => setBrowserFor("a")}
            />
            <DeckPanel
              deck={engine.decks.b}
              label="B"
              trackTitle={meta.b.title}
              trackBpm={meta.b.bpm}
              loading={meta.b.loading}
              onRequestLoad={() => setBrowserFor("b")}
            />
          </div>

          {/* Crossfader + master */}
          <div className="flex flex-wrap items-center gap-6 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] px-5 py-4">
            <div className="min-w-[280px] flex-1">
              <Crossfader
                value={xfade}
                onChange={handleSliderChange}
                onDragStart={() => {
                  hw.suppressUntilRef.current = Number.MAX_SAFE_INTEGER;
                }}
                onDragEnd={() => {
                  hw.suppressUntilRef.current = Date.now() + 500;
                }}
                hwActive={hwActive}
              />
            </div>
            <div className="flex items-end gap-3">
              <LinearSlider
                value={masterVol}
                min={0}
                max={1.2}
                step={0.01}
                label="master"
                width={120}
                onChange={(v) => {
                  setMasterVol(v);
                  engine.setMasterVolume(v);
                }}
              />
              <PeakMeter analyser={engine.masterAnalyser} height={44} />
            </div>
          </div>

          <PotMappingPanel
            hwStatus={hw.hwStatus}
            hwConfigured={hw.hwConfigured}
            mapping={hw.mapping}
            onChange={hw.setMapping}
          />
        </>
      ) : (
        <p className="workbench-readout text-xs text-[color:var(--ink-500)] lowercase">
          starting audio engine…
        </p>
      )}

      {browserFor ? (
        <DeckSourceBrowser
          deckLabel={browserFor === "a" ? "A" : "B"}
          sources={sources}
          onPick={(s) => void loadSource(browserFor, s)}
          onPickFile={(f) => void loadFile(browserFor, f)}
          onClose={() => setBrowserFor(null)}
        />
      ) : null}
    </div>
  );
}
