import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { MonitorSurface } from "@/components/monitor/monitor-surface";

interface PageProps {
  searchParams: Promise<{ webserial?: string }>;
}

export default async function MonitorPage({ searchParams }: PageProps) {
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
  const now = Date.now();
  const lastSeenMs = primaryDevice?.last_seen_at
    ? new Date(primaryDevice.last_seen_at).getTime()
    : 0;
  const isOnline = lastSeenMs > now - 2 * 60 * 1000;

  // WebSerial is now a dev-only escape hatch. The architecture has the
  // Teensy permanently plugged into the Pi (ground-loop fix), so the Pi is
  // the canonical bridge. Keeping WebSerial available behind ?webserial=1 so
  // we can still drive a Teensy plugged straight into a laptop when working
  // on firmware locally.
  const params = await searchParams;
  const webSerialRequested = params.webserial === "1";

  // No paired device AND no escape hatch → empty CTA (restored).
  if (!primaryDevice && !webSerialRequested) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-card">
          <MonitorSmartphone className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">No Ocarina paired yet</h1>
          <p className="text-sm text-muted-foreground">
            The Monitor shows live button presses, voice activity, and lets you
            capture a session for export. Pair a Pi to get started.
          </p>
          <p className="pt-2 text-xs text-muted-foreground/70">
            Working on firmware locally? Append{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              ?webserial=1
            </code>{" "}
            to this URL to talk to a Teensy plugged into your laptop directly.
          </p>
        </div>
        <Link
          href="/devices"
          className="inline-flex items-center rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Pair a Pi →
        </Link>
      </div>
    );
  }

  // WebSerial mode wins when explicitly requested, even if a Pi is paired —
  // useful for testing local firmware against the same UI.
  const useRealtime = primaryDevice !== null && isOnline && !webSerialRequested;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitor</h1>
        <p className="text-muted-foreground text-sm">
          Live debug view of the Ocarina. Watch buttons, voice, and loop state
          in real time, and capture a session to export as JSON or CSV.
          {webSerialRequested && (
            <span className="ml-1 font-mono text-amber-400">
              · WebSerial mode (dev)
            </span>
          )}
        </p>
      </div>

      <MonitorSurface
        deviceId={useRealtime ? primaryDevice.id : null}
        deviceName={primaryDevice?.name ?? null}
        initialLastSeenAt={primaryDevice?.last_seen_at ?? null}
        initialIsOnline={isOnline}
        initialIsRecent={lastSeenMs > now - 10 * 60 * 1000}
      />
    </div>
  );
}
