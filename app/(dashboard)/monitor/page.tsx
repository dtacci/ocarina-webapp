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
  const now = Date.now();
  const lastSeenMs = primaryDevice?.last_seen_at
    ? new Date(primaryDevice.last_seen_at).getTime()
    : 0;
  const isOnline = lastSeenMs > now - 2 * 60 * 1000;

  // If a Pi is paired and recently seen, prefer Realtime mode. Otherwise fall
  // through to WebSerial — the surface renders the connect card and lets the
  // user plug the Teensy in directly.
  const useRealtime = primaryDevice !== null && isOnline;

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
        deviceId={useRealtime ? primaryDevice.id : null}
        deviceName={primaryDevice?.name ?? null}
        initialLastSeenAt={primaryDevice?.last_seen_at ?? null}
        initialIsOnline={isOnline}
        initialIsRecent={lastSeenMs > now - 10 * 60 * 1000}
      />
    </div>
  );
}
