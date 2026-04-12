import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getRecordingById,
  getPublicRecording,
  getRecordingsBySessionId,
  type RecordingRow,
} from "@/lib/db/queries/recordings";
import { RecordingDetail } from "@/components/recordings/recording-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  // Try public recording for metadata (no auth needed)
  const recording = await getPublicRecording(id);
  if (!recording) return {};
  return {
    title: recording.title ?? "Recording — Digital Ocarina",
    description: recording.bpm
      ? `${recording.bpm} BPM · ${Math.floor(recording.duration_sec / 60)}m ${Math.floor(recording.duration_sec % 60)}s`
      : "Played on Digital Ocarina",
    openGraph: {
      title: recording.title ?? "Recording — Digital Ocarina",
      description: "Played on Digital Ocarina",
      type: "music.song",
    },
  };
}

export default async function RecordingDetailPage({ params }: Props) {
  const { id } = await params;

  // Check current user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Owner check first — full edit access
  let recording = null;
  let isOwner = false;

  if (user) {
    recording = await getRecordingById(id, user.id);
    if (recording) isOwner = true;
  }

  // Fall back to public check
  if (!recording) {
    recording = await getPublicRecording(id);
  }

  // Nothing accessible → 404
  if (!recording) notFound();

  // Fetch sibling tracks from the same session (owner-only, v1)
  let sessionTracks: RecordingRow[] = [];
  if (recording.session_id && isOwner) {
    const siblings = await getRecordingsBySessionId(recording.session_id, user!.id);
    sessionTracks = siblings.filter((t) => t.id !== recording.id);
  }

  return (
    <RecordingDetail
      recording={recording}
      isOwner={isOwner}
      isAuthenticated={!!user}
      sessionTracks={sessionTracks}
    />
  );
}
