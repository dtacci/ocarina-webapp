import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecordingsBySessionId } from "@/lib/db/queries/recordings";
import { getSessionMix } from "@/lib/db/queries/session-mixes";
import { TracksClient } from "@/components/track-editor/tracks-client";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export const metadata = {
  title: "Track Mixer — Digital Ocarina",
};

export default async function TracksPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // sessionId is a public.sessions id; its recordings carry it in session_id.
  const related = await getRecordingsBySessionId(sessionId, user.id);
  if (related.length === 0) notFound();

  const master = related.find((r) => r.recording_type === "master") ?? null;
  const stems = related.filter((r) => r.recording_type === "stem");
  // Mix the stems when they exist; otherwise whatever the session holds.
  const sources = stems.length > 0 ? stems : related;

  const mix = await getSessionMix(sessionId);

  return (
    <TracksClient
      sessionId={sessionId}
      sessionTitle={master?.title ?? "Untitled session"}
      sessionBpm={master?.bpm ?? sources[0]?.bpm ?? null}
      stems={sources.map((r, i) => ({
        id: r.id,
        title: r.title ?? `Track ${i + 1}`,
        url: r.blob_url,
        durationSec: r.duration_sec,
        peaks: Array.isArray(r.waveform_peaks) ? (r.waveform_peaks as number[]) : null,
      }))}
      initialMix={mix ? { name: mix.name, channels: mix.channels, master: mix.master, arrangement: mix.arrangement } : null}
    />
  );
}
