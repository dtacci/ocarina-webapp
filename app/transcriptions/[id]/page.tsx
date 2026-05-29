import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getRecordingById,
  getPublicRecording,
} from "@/lib/db/queries/recordings";
import {
  getDefaultRender,
  getPublicDefaultRender,
  getTranscriptionEvents,
} from "@/lib/db/queries/transcription";
import { TranscriptionDetail } from "@/components/transcription/transcription-detail";
import { DEFAULT_PARAMS, type DeriveParams, type Warning } from "@/lib/transcription/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const recording = await getPublicRecording(id);
  if (!recording) return {};
  return {
    title: `${recording.title ?? "Transcription"} — Digital Ocarina`,
    description: "A voice transcription rendered as sheet music.",
  };
}

/** Warnings live alongside notes in the render's notation_jsonb. */
function extractWarnings(notation: unknown): Warning[] {
  if (
    notation &&
    typeof notation === "object" &&
    Array.isArray((notation as { warnings?: unknown }).warnings)
  ) {
    return (notation as { warnings: Warning[] }).warnings;
  }
  return [];
}

export default async function TranscriptionDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Owner first (full access), then fall back to a public share.
  let recording = null;
  let isOwner = false;
  if (user) {
    recording = await getRecordingById(id, user.id);
    if (recording) isOwner = true;
  }
  if (!recording) {
    recording = await getPublicRecording(id);
  }
  if (!recording || recording.recording_type !== "transcription_session") {
    notFound();
  }

  // Default render via the matching scoped query.
  const render = isOwner
    ? await getDefaultRender(id)
    : await getPublicDefaultRender(id);

  // Owners get the raw events + params so edits can re-derive in-browser.
  const eventsRow = isOwner ? await getTranscriptionEvents(id) : null;
  const initialParams =
    (render?.params_jsonb as DeriveParams | undefined) ?? DEFAULT_PARAMS;

  return (
    <TranscriptionDetail
      recording={recording}
      musicxml={render?.musicxml ?? null}
      warnings={extractWarnings(render?.notation_jsonb)}
      isOwner={isOwner}
      isAuthenticated={!!user}
      events={eventsRow?.events_jsonb ?? null}
      header={eventsRow?.header_jsonb ?? null}
      initialParams={initialParams}
    />
  );
}
