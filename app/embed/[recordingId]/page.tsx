import { notFound } from "next/navigation";
import { getPublicRecording } from "@/lib/db/queries/recordings";
import { EmbedPlayer } from "@/components/embed/embed-player";

interface Props {
  params: Promise<{ recordingId: string }>;
}

export default async function EmbedPage({ params }: Props) {
  const { recordingId } = await params;
  const recording = await getPublicRecording(recordingId);
  if (!recording) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <EmbedPlayer recording={recording} />
    </div>
  );
}
