import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDevice } from "@/lib/db/queries/devices";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultConfig } from "@/lib/config/default-config";
import { ConfigForm } from "@/components/device-config/config-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DeviceConfigPage({ params }: Props) {
  const { id } = await params;

  const device = await getDevice(id);
  if (!device) notFound();

  // Fetch latest config snapshot from DB; fall back to defaults
  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("device_configs")
    .select("config_json, version, source, created_at")
    .eq("device_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const currentConfig = (latest?.config_json as Record<string, unknown>) ?? defaultConfig;
  const configVersion = latest?.version ?? 0;
  const configSource = (latest?.source as string) ?? "default";

  // Determine if Pi is online (seen in last 2 minutes)
  const isOnline = device.last_seen_at
    ? Date.now() - new Date(device.last_seen_at).getTime() < 120_000
    : false;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <Link
          href="/devices"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to Devices
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{device.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Configure your Ocarina — changes are pushed automatically.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`size-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
      </div>

      <ConfigForm
        deviceId={id}
        currentConfig={currentConfig}
        configVersion={configVersion}
        configSource={configSource}
        isOnline={isOnline}
      />
    </div>
  );
}
