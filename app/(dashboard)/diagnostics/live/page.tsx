import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { LiveConsole } from "@/components/diagnostics/live-console";

export default async function LiveConsolePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Sign in to view the live console</p>
      </div>
    );
  }

  const { data: deviceRows } = await supabase
    .from("devices")
    .select("id, name, last_seen_at")
    .eq("user_id", user.id)
    .neq("device_type", "web_browser")
    .order("last_seen_at", { ascending: false, nullsFirst: false });

  const primaryDevice = deviceRows?.[0] ?? null;

  if (!primaryDevice) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-card">
          <MonitorSmartphone className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">No Ocarina paired yet</h1>
          <p className="text-sm text-muted-foreground">
            The Live Console shows button presses, notes, FX cycles, and loop state from a
            paired Pi in real time. Pair one first and the console will pick it up
            automatically.
          </p>
        </div>
        <Link
          href="/devices"
          className="inline-flex items-center rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Pair an Ocarina →
        </Link>
      </div>
    );
  }

  const now = Date.now();
  const lastSeenMs = primaryDevice.last_seen_at
    ? new Date(primaryDevice.last_seen_at).getTime()
    : 0;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live console</h1>
        <p className="text-muted-foreground text-sm">
          Press-and-test. Mirrors physical button presses, notes, FX cycles, and loop state
          in real time. Clicking a virtual button simulates the hardware press.
        </p>
      </div>

      <LiveConsole
        deviceId={primaryDevice.id}
        deviceName={primaryDevice.name ?? null}
        initialLastSeenAt={primaryDevice.last_seen_at ?? null}
        initialIsOnline={lastSeenMs > now - 2 * 60 * 1000}
        initialIsRecent={lastSeenMs > now - 10 * 60 * 1000}
      />
    </div>
  );
}
