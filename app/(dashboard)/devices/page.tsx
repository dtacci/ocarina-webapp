import { getDevices } from "@/lib/db/queries/devices";
import { DeviceCard } from "@/components/devices/device-card";
import { RegisterDeviceDialog } from "@/components/devices/register-device-dialog";
import { MonitorSmartphone } from "lucide-react";

export default async function DevicesPage() {
  const devices = await getDevices();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="text-muted-foreground">
            Register your Ocarina and manage connected devices.
          </p>
        </div>
      </div>

      <RegisterDeviceDialog />

      {devices.length > 0 ? (
        <div className="space-y-3">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <MonitorSmartphone className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No devices registered</p>
            <p className="text-xs text-muted-foreground">
              Register your Ocarina above to enable sync, real-time control, and more
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
