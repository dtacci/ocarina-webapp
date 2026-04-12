import { getDevices } from "@/lib/db/queries/devices";
import { LooperDashboard } from "@/components/looper/looper-dashboard";
import { MonitorSmartphone, CircleDot } from "lucide-react";
import Link from "next/link";

export default async function LooperPage() {
  const devices = await getDevices();
  const piDevice = devices.find((d) => d.capabilities?.looper && d.device_type !== "web_browser");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visual Looper</h1>
          <p className="text-muted-foreground">
            Real-time loop engine — track states, BPM, and mute/record controls.
          </p>
        </div>
      </div>

      {piDevice ? (
        <LooperDashboard deviceId={piDevice.id} deviceName={piDevice.name} />
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center space-y-3">
            {devices.length === 0 ? (
              <>
                <MonitorSmartphone className="mx-auto size-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">No devices registered</p>
                <p className="text-xs text-muted-foreground">
                  Register your Ocarina on the{" "}
                  <Link href="/devices" className="underline hover:text-foreground">
                    Devices page
                  </Link>{" "}
                  to enable real-time looper control.
                </p>
              </>
            ) : (
              <>
                <CircleDot className="mx-auto size-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">No looper-capable device found</p>
                <p className="text-xs text-muted-foreground">
                  Register a Pi Pro or Mobile device to use the looper dashboard.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
