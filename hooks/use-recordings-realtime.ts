"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RecordingRow } from "@/lib/db/queries/recordings";

/**
 * Subscribes to INSERT events on the recordings table for the given userId.
 * Calls onInsert when a new recording arrives — from a Pi upload or browser upload.
 * No-ops when userId is null (unauthenticated).
 *
 * Mirrors the pattern in hooks/use-loop-state.ts.
 */
export function useRecordingsRealtime(
  userId: string | null,
  onInsert: (recording: RecordingRow) => void
) {
  // Stable ref so the effect doesn't re-subscribe when the parent re-renders
  const stableOnInsert = useCallback(onInsert, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`recordings_for_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "recordings",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          // Basic guard — malformed payloads should not crash the gallery
          if (!raw?.id || !raw?.blob_url) return;

          stableOnInsert({
            id: raw.id as string,
            user_id: raw.user_id as string,
            device_id: (raw.device_id as string | null) ?? null,
            title: (raw.title as string) ?? "Untitled",
            blob_url: raw.blob_url as string,
            duration_sec: Number(raw.duration_sec ?? 0),
            sample_rate: Number(raw.sample_rate ?? 44100),
            bpm: raw.bpm != null ? Number(raw.bpm) : null,
            kit_id: (raw.kit_id as string | null) ?? null,
            waveform_peaks: (raw.waveform_peaks as number[] | null) ?? null,
            session_id: (raw.session_id as string | null) ?? null,
            recording_type: ((raw.recording_type as string) ?? "upload") as RecordingRow["recording_type"],
            is_public: Boolean(raw.is_public),
            created_at: raw.created_at as string,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, stableOnInsert]);
}
