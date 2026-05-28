import Link from "next/link";
import { Gamepad2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultConfig } from "@/lib/config/default-config";
import { ConfiguratorSurface } from "@/components/configurator/configurator-surface";

export default async function ConfiguratorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Sign in to use the configurator</p>
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
          <Gamepad2 className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">No Ocarina paired yet</h1>
          <p className="text-sm text-muted-foreground">
            The configurator remaps buttons and live-tunes mic/voice settings on
            a paired device. Pair one first.
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

  // Pull the latest stored config — bypassing RLS via admin since we've already
  // confirmed user ownership above (matches the pattern used by
  // /devices/[id]/config).
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

  const now = Date.now();
  const lastSeenMs = primaryDevice.last_seen_at
    ? new Date(primaryDevice.last_seen_at).getTime()
    : 0;
  const isOnline = lastSeenMs > now - 2 * 60 * 1000;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurator</h1>
        <p className="text-muted-foreground text-sm">
          Reassign buttons on the fly and tune live controls. Switch profiles
          to flip the whole layout, override individual buttons on top, and
          click Apply to push to the Pi.
        </p>
      </div>

      <ConfiguratorSurface
        deviceId={primaryDevice.id}
        deviceName={primaryDevice.name}
        isOnline={isOnline}
        currentConfig={merged}
        configVersion={cfgRow?.version ?? 0}
        configSource={cfgRow?.source ?? "default"}
      />
    </div>
  );
}
