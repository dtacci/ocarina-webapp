"use client";

import { createContext, useContext, useMemo } from "react";
import type { SampleWithVibes } from "@/lib/db/queries/samples";
import type { Track } from "@/lib/stores/audio-player";

interface SampleListContextValue {
  samples: SampleWithVibes[];
  /** Build the Zustand-player Track for a sample, lazily (no pre-mapping 48 items). */
  toTrack: (sample: SampleWithVibes) => Track;
}

const SampleListContext = createContext<SampleListContextValue | null>(null);

export function sampleToTrack(sample: SampleWithVibes): Track {
  const subtitleParts: string[] = [];
  if (sample.family) subtitleParts.push(sample.family);
  if (sample.root_note) subtitleParts.push(sample.root_note);
  return {
    id: sample.id,
    kind: "sample",
    title: sample.id,
    subtitle: subtitleParts.join(" · ") || undefined,
    src: sample.mp3_blob_url ?? "",
    peaks: sample.waveform_peaks ?? undefined,
    duration: sample.duration_sec,
    href: `/library/${encodeURIComponent(sample.id)}`,
  };
}

export function SampleListProvider({
  samples,
  children,
}: {
  samples: SampleWithVibes[];
  children: React.ReactNode;
}) {
  const value = useMemo<SampleListContextValue>(
    () => ({ samples, toTrack: sampleToTrack }),
    [samples],
  );
  return (
    <SampleListContext.Provider value={value}>
      {children}
    </SampleListContext.Provider>
  );
}

export function useSampleList() {
  return useContext(SampleListContext);
}
