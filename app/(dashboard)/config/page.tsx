import { getDevices } from "@/lib/db/queries/devices";
import { ConfigForm } from "@/components/config/config-form";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

export default async function ConfigPage() {
  const devices = await getDevices();
  const primaryDevice = devices[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground">
            Manage your Ocarina&apos;s 70+ settings across 11 domains.
          </p>
        </div>
        {primaryDevice && (
          <Badge variant="secondary" className="text-xs">
            {primaryDevice.name}
          </Badge>
        )}
      </div>

      {!primaryDevice && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4">
          <Settings className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">No device registered</p>
            <p className="text-muted-foreground">
              You can still edit and download config as YAML. Register a device to save configs to the cloud.
            </p>
          </div>
        </div>
      )}

      <ConfigForm deviceId={primaryDevice?.id} />
    </div>
  );
}
