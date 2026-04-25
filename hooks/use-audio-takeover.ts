"use client";

import { useEffect } from "react";
import { useAudioPlayerStore } from "@/lib/stores/audio-player";

/**
 * Stops the global audio player when the current surface mounts.
 *
 * Use on pages/components that own their own audio pipeline (the looper,
 * the sample-editor, karaoke MIDI playback, …) so that we never have two
 * engines producing sound at once. The resume-chip in the player bar will
 * let the user pick up where they left off when they come back.
 */
export function useAudioTakeover() {
  useEffect(() => {
    useAudioPlayerStore.getState().stop();
  }, []);
}
