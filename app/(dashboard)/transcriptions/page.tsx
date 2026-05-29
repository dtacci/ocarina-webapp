import { redirect } from "next/navigation";
import { Music4 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listTranscriptionSessions } from "@/lib/db/queries/transcription";
import { TranscriptionsList } from "@/components/transcription/transcriptions-list";

export const metadata = {
  title: "Transcriptions — Digital Ocarina",
};

export default async function TranscriptionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sessions = await listTranscriptionSessions({ limit: 60 });

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <Music4 className="size-5" />
          <h1 className="text-xl font-semibold tracking-tight">Transcriptions</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Sessions you&apos;ve sung, rendered as sheet music. Open one to tweak the
          tempo, key, and timing.
        </p>
      </header>

      <TranscriptionsList initial={sessions} />
    </div>
  );
}
