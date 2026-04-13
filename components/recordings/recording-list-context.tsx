"use client";

import { createContext, useContext, useMemo } from "react";
import type { RecordingRow } from "@/lib/db/queries/recordings";
import type { SessionRecording } from "@/lib/db/queries/sessions";
import type { Track } from "@/lib/stores/audio-player";

interface RecordingListContextValue {
  recordings: Array<RecordingRow | SessionRecording>;
  toTrack: (recording: RecordingRow | SessionRecording) => Track;
}

const RecordingListContext =
  createContext<RecordingListContextValue | null>(null);

export function recordingToTrack(
  recording: RecordingRow | SessionRecording,
): Track {
  const subtitleParts: string[] = [];
  if ("bpm" in recording && recording.bpm) {
    subtitleParts.push(`${recording.bpm} BPM`);
  }
  if ("kit_id" in recording && recording.kit_id) {
    subtitleParts.push(recording.kit_id.replace(/-/g, " "));
  }
  if (recording.recording_type === "master") subtitleParts.push("mix");
  else if (recording.recording_type === "stem") subtitleParts.push("stem");

  const title =
    "title" in recording && recording.title
      ? recording.title
      : "Untitled recording";

  return {
    id: recording.id,
    kind: "recording",
    title,
    subtitle: subtitleParts.join(" · ") || undefined,
    src: recording.blob_url,
    peaks: recording.waveform_peaks ?? undefined,
    duration: recording.duration_sec,
    href: `/recordings/${recording.id}`,
  };
}

export function RecordingListProvider({
  recordings,
  children,
}: {
  recordings: Array<RecordingRow | SessionRecording>;
  children: React.ReactNode;
}) {
  const value = useMemo<RecordingListContextValue>(
    () => ({ recordings, toTrack: recordingToTrack }),
    [recordings],
  );
  return (
    <RecordingListContext.Provider value={value}>
      {children}
    </RecordingListContext.Provider>
  );
}

export function useRecordingList() {
  return useContext(RecordingListContext);
}
