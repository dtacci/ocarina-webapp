"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SamplerEngine } from "@/lib/audio/sampler-engine";
import type { EnsembleResult, EnsembleVoice } from "@/lib/ensemble/types";

export type EnsembleStatus = "idle" | "loading" | "ready";

/** Stable per-voice key (voices share roles/samples, so index it). */
export function voiceKey(index: number): string {
  return `v${index}`;
}

/**
 * Owns the matched ensemble + its SamplerEngine. loadEnsemble decodes the
 * matched samples into pitched players; trigger/swapVoice drive playback and
 * alternative-sample substitution from the pads UI.
 */
export function useEnsemble() {
  const engineRef = useRef<SamplerEngine | null>(null);
  if (engineRef.current == null) engineRef.current = new SamplerEngine();

  const [ensemble, setEnsemble] = useState<EnsembleResult | null>(null);
  const [status, setStatus] = useState<EnsembleStatus>("idle");

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const loadEnsemble = useCallback(async (result: EnsembleResult) => {
    setEnsemble(result);
    setStatus("loading");
    const specs = result.voices
      .map((v, i) => ({ id: voiceKey(i), url: v.url }))
      .filter((s): s is { id: string; url: string } => Boolean(s.url));
    await engineRef.current?.loadVoices(specs);
    setStatus("ready");
  }, []);

  const trigger = useCallback((index: number, note?: string, velocity?: number) => {
    void engineRef.current?.trigger(voiceKey(index), note, velocity);
  }, []);

  /** Swap a voice to one of its alternative samples and reload just that voice. */
  const swapVoice = useCallback(
    async (index: number, alt: { sampleId: string; title: string | null; url: string }) => {
      await engineRef.current?.loadVoice(voiceKey(index), alt.url);
      setEnsemble((prev) => {
        if (!prev) return prev;
        const voices = prev.voices.slice();
        const current = voices[index];
        if (!current) return prev;
        // Demote the current pick into alternatives, promote the chosen one.
        const nextAlts = current.alternatives.filter((a) => a.sampleId !== alt.sampleId);
        if (current.sampleId && current.url) {
          nextAlts.push({ sampleId: current.sampleId, title: current.sampleTitle, url: current.url });
        }
        const swapped: EnsembleVoice = {
          ...current,
          sampleId: alt.sampleId,
          sampleTitle: alt.title,
          url: alt.url,
          alternatives: nextAlts,
        };
        voices[index] = swapped;
        return { ...prev, voices };
      });
    },
    [],
  );

  return { ensemble, setEnsemble, status, loadEnsemble, trigger, swapVoice };
}
