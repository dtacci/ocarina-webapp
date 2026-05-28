import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { MonitorSurface } from "@/components/monitor/monitor-surface";

export default async function MonitorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Sign in to view the monitor</p>
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
            The Monitor shows live button presses, voice activity, and lets you
            capture a session for export. Pair a device first.
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
        <h1 className="text-2xl font-bold tracking-tight">Monitor</h1>
        <p className="text-muted-foreground text-sm">
          Live debug view of the Ocarina. Watch buttons, voice, and loop state
          in real time, and capture a session to export as JSON or CSV for
          sharing or debugging.
        </p>
      </div>

      <MonitorSurface
        deviceId={primaryDevice.id}
        deviceName={primaryDevice.name ?? null}
        initialLastSeenAt={primaryDevice.last_seen_at ?? null}
        initialIsOnline={lastSeenMs > now - 2 * 60 * 1000}
        initialIsRecent={lastSeenMs > now - 10 * 60 * 1000}
      />
    </div>
  );
}
