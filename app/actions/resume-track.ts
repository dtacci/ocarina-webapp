"use server";

import { getSample } from "@/lib/db/queries/samples";
import { getRecordingById } from "@/lib/db/queries/recordings";
import { createClient } from "@/lib/supabase/server";
import { sampleToTrack } from "@/components/samples/sample-list-context";
import { recordingToTrack } from "@/components/recordings/recording-list-context";
import type { Track, TrackKind } from "@/lib/stores/audio-player";

/**
 * Refetch a persisted "last played" track from its snapshot. Validates
 * the track still exists and the caller owns it (for recordings), and
 * returns a fresh Track the client can feed to playTrack().
 *
 * Returns null when the track was deleted, access was revoked, or the
 * blob is gone. The client should drop the resume chip in that case.
 */
export async function resumeTrack(
  id: string,
  kind: TrackKind,
): Promise<Track | null> {
  if (!id) return null;

  if (kind === "sample") {
    const sample = await getSample(id);
    if (!sample || !sample.mp3_blob_url) return null;
    return sampleToTrack(sample);
  }

  if (kind === "recording") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const rec = await getRecordingById(id, user.id);
    if (!rec) return null;
    return recordingToTrack(rec);
  }

  return null;
}
