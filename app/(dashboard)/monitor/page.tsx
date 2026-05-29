import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MonitorSurface,
  type MonitorMode,
  type TunablesProps,
} from "@/components/monitor/monitor-surface";
import { isOcarinaApiConfigured } from "@/lib/ocarina-api";
import { defaultConfig } from "@/lib/config/default-config";

const TUNABLE_KEYS = [
  "vad.silence_duration",
  "vad.aggressiveness",
  "tts.ducking.duck_level",
] as const;

interface PageProps {
  searchParams: Promise<{ webserial?: string; realtime?: string }>;
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

  const params = await searchParams;
  const webSerialRequested = params.webserial === "1";
  const realtimeForced = params.realtime === "1";

  const piRestAvailable = isOcarinaApiConfigured();

  // Always look up the user's primary device — used for realtime mode AND for
  // the tunables panel (which PATCHes /api/sync/config and needs a deviceId
  // regardless of whether the live transport is pi_rest or realtime).
  const { data: deviceRows } = await supabase
    .from("devices")
    .select("id, name, last_seen_at")
    .eq("user_id", user.id)
    .neq("device_type", "web_browser")
    .order("last_seen_at", { ascending: false, nullsFirst: false });
  const primaryDevice = deviceRows?.[0] ?? null;

  // Source priority:
  //   ?webserial=1 → WebSerial (dev / local firmware loop, escape hatch)
  //   Pi REST configured AND not ?realtime=1 → Pi REST (preferred)
  //   ?realtime=1 OR no Pi REST → fall back to legacy Supabase Realtime
  //   None of the above + no Pi paired → empty CTA
  let mode: MonitorMode | null = null;

  if (webSerialRequested) {
    mode = { kind: "webserial" };
  } else if (piRestAvailable && !realtimeForced) {
    mode = { kind: "pi_rest" };
  } else if (primaryDevice) {
    const now = Date.now();
    const lastSeenMs = primaryDevice.last_seen_at
      ? new Date(primaryDevice.last_seen_at).getTime()
      : 0;
    mode = {
      kind: "realtime",
      deviceId: primaryDevice.id,
      deviceName: primaryDevice.name ?? null,
      initialLastSeenAt: primaryDevice.last_seen_at ?? null,
      initialIsOnline: lastSeenMs > now - 2 * 60 * 1000,
      initialIsRecent: lastSeenMs > now - 10 * 60 * 1000,
    };
  }

  // Tunables — independent of mode. Available whenever a paired Pi exists,
  // since the PATCH /api/sync/config path writes through device_configs
  // (sync_agent.py / Pi pull is the legacy consumer; future Pi REST owns
  // its own settings but this stays usable as the bridge).
  let tunables: TunablesProps | null = null;
  if (primaryDevice) {
    const admin = createAdminClient();
    const { data: cfgRow } = await admin
      .from("device_configs")
      .select("config_json, version, source")
      .eq("device_id", primaryDevice.id)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    const merged: Record<string, unknown> = {
      ...defaultConfig,
      ...((cfgRow?.config_json as Record<string, unknown>) ?? {}),
    };
    const values: Record<string, unknown> = {};
    for (const k of TUNABLE_KEYS) values[k] = merged[k];
    tunables = {
      deviceId: primaryDevice.id,
      deviceName: primaryDevice.name ?? null,
      values,
      configVersion: cfgRow?.version ?? 0,
    };
  }

  if (!mode) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-card">
          <MonitorSmartphone className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">No Ocarina paired yet</h1>
          <p className="text-sm text-muted-foreground">
            The Monitor shows live button presses, voice activity, and lets you
            capture a session for export.
          </p>
          <p className="pt-2 text-xs text-muted-foreground/70">
            Working on firmware locally? Append{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              ?webserial=1
            </code>{" "}
            to talk to a Teensy plugged into your laptop directly.
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

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitor</h1>
        <p className="text-muted-foreground text-sm">
          Live debug view of the Ocarina. Watch buttons, voice, and loop state
          in real time, and capture a session to export as JSON or CSV.
          {mode.kind === "webserial" && (
            <span className="ml-1 font-mono text-amber-400">· WebSerial mode (dev)</span>
          )}
          {mode.kind === "realtime" && realtimeForced && (
            <span className="ml-1 font-mono text-amber-400">
              · Realtime mode (forced via ?realtime=1)
            </span>
          )}
        </p>
      </div>

      <MonitorSurface mode={mode} tunables={tunables} />
    </div>
  );
}
