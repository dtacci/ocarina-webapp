"use client";

/**
 * DJ mode — Pioneer-style battle layout: CDJ deck A | DJM mixer column |
 * CDJ deck B, with the ocarina's physical pots + GPIO buttons as control
 * surface (high-rate "pots"/"gpio" streams via use-dj-hardware).
 *
 * Control-ownership rules:
 *  - Knobs/faders: React state is the source of truth, pushed into the engine.
 *  - Crossfader: two writers (slider drag + hardware pot). Pot events drive
 *    the engine directly at ~30 Hz (no setState) and a 10 Hz interval reflects
 *    the latest value back into the slider; dragging the slider suppresses pot
 *    input until 500 ms after release (last-writer-wins without fighting).
 *  - Hardware buttons: discrete actions (hot cues / play toggle) on the
 *    crossfader-favored deck — same focus convention as the filter pot.
 *  - Transport readouts: rAF straight into the DOM (see DeckPanel).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { createDjEngine, type DjEngine, type DeckId } from "@/lib/audio/dj-engine";
import { computePeaksFromBuffer } from "@/lib/audio/compute-peaks";
import type { DjSource } from "@/lib/db/queries/dj";
import { useAudioTakeover } from "@/hooks/use-audio-takeover";
import { useDjHardware } from "@/hooks/use-dj-hardware";
import { DeckPanel } from "./deck";
import { DeckSourceBrowser } from "./deck-source-browser";
import { MixerColumn } from "./mixer-column";
import { PotMappingPanel } from "./pot-mapping-panel";

interface DeckTrackMeta {
  title: string | null;
  bpm: number | null;
  loading: boolean;
}

const EMPTY_META: DeckTrackMeta = { title: null, bpm: null, loading: false };

/** Resolved `?load=` handoff (see app/(dashboard)/dj/page.tsx). */
export interface DjAutoload {
  source: DjSource;
  deck: DeckId;
}

export function DjSurface({
  sources,
  autoload = null,
}: {
  sources: DjSource[];
  autoload?: DjAutoload | null;
}) {
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
  const [peaks, setPeaks] = useState<Record<DeckId, number[] | null>>({
    a: null,
    b: null,
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

  // The deck hardware buttons / the filter pot act on: an explicit focus from
  // the mapping, or wherever the crossfader currently leans ("follow").
  // Read through a ref — these fire from WS handlers at event rate.
  const deckFocusRef = useRef<"follow" | "a" | "b">("follow");
  const favoredDeck = (): DeckId =>
    deckFocusRef.current === "follow"
      ? xfadeRef.current < 0.5 ? "a" : "b"
      : deckFocusRef.current;

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
      engineRef.current?.decks[favoredDeck()].setFilter(v * 2 - 1);
    },
    onHotCue: (i) => {
      const deck = engineRef.current?.decks[favoredDeck()];
      if (!deck) return;
      // Pad semantics, same as a click: empty = set, stored = jump.
      if (deck.getState().hotCues[i] === null) deck.setHotCue(i);
      else deck.jumpHotCue(i);
    },
    onPlayToggle: () => {
      engineRef.current?.decks[favoredDeck()].toggle();
    },
  });
  useEffect(() => {
    deckFocusRef.current = hw.mapping.deckFocus;
  }, [hw.mapping.deckFocus]);

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
        // Unlock opportunistically but never block on it: ?load= autoloads
        // run before any user gesture, where Tone.start() stays pending.
        // Decoding works on a suspended context; the pointerdown listener
        // below resumes audio before anything needs to sound.
        void Tone.start().catch(() => {});
        const buffer = await Tone.getContext().rawContext.decodeAudioData(bytes);
        eng.decks[deckId].load(buffer, { title, bpm });
        setPeaks((p) => ({ ...p, [deckId]: computePeaksFromBuffer(buffer, 600) }));
        setMeta((m) => ({ ...m, [deckId]: { title, bpm, loading: false } }));
      } catch (err) {
        setMeta((m) => ({ ...m, [deckId]: EMPTY_META }));
        setPeaks((p) => ({ ...p, [deckId]: null }));
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

  // ?load= handoff: pull the resolved source into its deck once the engine
  // exists. Runs pre-gesture, so make sure the first interaction anywhere
  // resumes the audio context (play/pads would otherwise stay silent).
  const autoloadedRef = useRef(false);
  useEffect(() => {
    if (!engine || !autoload || autoloadedRef.current) return;
    autoloadedRef.current = true;
    const unlock = () => void Tone.start().catch(() => {});
    window.addEventListener("pointerdown", unlock, { once: true });
    void loadSource(autoload.deck, autoload.source);
    return () => window.removeEventListener("pointerdown", unlock);
  }, [engine, autoload, loadSource]);

  return (
    <div className="workbench dj-rig -m-6 min-h-[calc(100vh-3.5rem)] space-y-5 p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="workbench-label text-base text-[color:var(--ink-300)]">dj decks</h1>
        <p className="workbench-readout text-[10px] text-[color:var(--ink-600)] lowercase">
          load a track on each side · sweep the crossfader · map hardware below
        </p>
      </header>

      {loadError ? (
        <p role="alert" className="workbench-readout border border-[color:var(--wb-oxide)] px-3 py-2 text-xs text-[color:var(--wb-oxide)] lowercase">
          {loadError}
        </p>
      ) : null}

      {engine ? (
        <>
          {/* Battle layout: CDJ | DJM | CDJ. Stacks below xl. */}
          <div className="flex flex-col items-stretch gap-5 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-start">
            <DeckPanel
              deck={engine.decks.a}
              label="A"
              trackTitle={meta.a.title}
              trackBpm={meta.a.bpm}
              peaks={peaks.a}
              loading={meta.a.loading}
              onRequestLoad={() => setBrowserFor("a")}
            />
            <MixerColumn
              engine={engine}
              xfade={xfade}
              onXfadeChange={handleSliderChange}
              onXfadeDragStart={() => {
                hw.suppressUntilRef.current = Number.MAX_SAFE_INTEGER;
              }}
              onXfadeDragEnd={() => {
                hw.suppressUntilRef.current = Date.now() + 500;
              }}
              hwActive={hwActive}
              masterVol={masterVol}
              onMasterVol={(v) => {
                setMasterVol(v);
                engine.setMasterVolume(v);
              }}
            />
            <DeckPanel
              deck={engine.decks.b}
              label="B"
              trackTitle={meta.b.title}
              trackBpm={meta.b.bpm}
              peaks={peaks.b}
              loading={meta.b.loading}
              onRequestLoad={() => setBrowserFor("b")}
            />
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
