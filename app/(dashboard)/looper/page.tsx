import { getDevices } from "@/lib/db/queries/devices";
import { LooperDashboard } from "@/components/looper/looper-dashboard";
import Link from "next/link";

export default async function LooperPage() {
  const devices = await getDevices();
  const piDevice = devices.find(
    (d) => d.capabilities?.looper && d.device_type !== "web_browser"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visual Looper</h1>
          <p className="text-muted-foreground">
            Real-time loop engine — track states, BPM, and mute/record controls.
          </p>
        </div>
        {!piDevice && (
          <Link
            href="/devices"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Connect a device for live sync →
          </Link>
        )}
      </div>

      {/* Always show the dashboard. deviceId=null = browser/demo mode. */}
      <LooperDashboard
        deviceId={piDevice?.id ?? null}
        deviceName={piDevice?.name ?? "This Browser"}
      />
    </div>
  );
}
