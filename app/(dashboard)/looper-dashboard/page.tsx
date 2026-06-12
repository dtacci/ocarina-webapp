import Link from "next/link";
import { Disc3 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isOcarinaApiConfigured } from "@/lib/ocarina-api";
import { getDevices } from "@/lib/db/queries/devices";
import { LooperDashboardSurface } from "@/components/looper/looper-dashboard-surface";
import { DrumMachine } from "@/components/looper/drum-machine";

export default async function LooperDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Sign in to view the looper dashboard
        </p>
      </div>
    );
  }

  if (!isOcarinaApiConfigured()) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-card">
          <Disc3 className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Pi API not configured</h1>
          <p className="text-sm text-muted-foreground">
            The looper dashboard talks directly to your Pi&apos;s FastAPI
            server. Set the OCARINA env vars in Vercel, redeploy, and the
            looper&apos;s 4-track state shows up live.
          </p>
        </div>
        <Link
          href="/monitor"
          className="inline-flex items-center rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Monitor instead →
        </Link>
      </div>
    );
  }

  const devices = await getDevices();
  const piDevice = devices.find(
    (d) => d.capabilities?.looper && d.device_type !== "web_browser"
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Looper</h1>
        <p className="text-muted-foreground text-sm">
          Live state of the Teensy&apos;s 4-track looper — record/play/mute
          state per track, BPM, master length, and the playhead.
        </p>
      </div>
      <LooperDashboardSurface />
      {/* Companion sequencer, pre-loaded with starter grooves and the kit
          roster — tempo-locks to the looper when the Pi broadcasts a BPM. */}
      <DrumMachine
        compact
        deviceId={piDevice?.id ?? null}
        deviceName={piDevice?.name ?? "This Browser"}
      />
    </div>
  );
}
