import { MonitorSmartphone } from "lucide-react";

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <p className="text-muted-foreground">
          Register your Ocarina and manage connected devices.
        </p>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <MonitorSmartphone className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No devices registered</p>
          <p className="text-xs text-muted-foreground">
            Register your Ocarina to enable sync, real-time control, and more
          </p>
        </div>
      </div>
    </div>
  );
}
