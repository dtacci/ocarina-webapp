import { getRecordings } from "@/lib/db/queries/recordings";
import { RecordingCard } from "@/components/recordings/recording-card";
import { Disc3 } from "lucide-react";

export default async function RecordingsPage() {
  const recordings = await getRecordings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recordings</h1>
        <p className="text-muted-foreground">
          Your recording library. Auto-synced from your Ocarina.
        </p>
      </div>

      {recordings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recordings.map((rec) => (
            <RecordingCard key={rec.id} recording={rec} />
          ))}
        </div>
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Disc3 className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No recordings yet</p>
            <p className="text-xs text-muted-foreground">
              Register a device to start syncing recordings
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
