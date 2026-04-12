import { Badge } from "@/components/ui/badge";
import type { DeviceRow } from "@/lib/db/queries/devices";

const typeLabels: Record<string, string> = {
  pi_pro: "Raspberry Pi",
  mobile_app: "Mobile App",
  arduino_lite: "Arduino Lite",
  web_browser: "Web Browser",
};

const typeColors: Record<string, string> = {
  pi_pro: "bg-emerald-500",
  mobile_app: "bg-blue-500",
  arduino_lite: "bg-amber-500",
  web_browser: "bg-violet-500",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DeviceCard({ device }: { device: DeviceRow }) {
  const isOnline = device.last_seen_at &&
    (Date.now() - new Date(device.last_seen_at).getTime()) < 120000; // 2 min

  const capabilities = Object.entries(device.capabilities || {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`size-2.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />
          <h3 className="font-medium">{device.name}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          <span className={`inline-block size-1.5 rounded-full mr-1.5 ${typeColors[device.device_type] ?? "bg-gray-500"}`} />
          {typeLabels[device.device_type] ?? device.device_type}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Last seen</span>
          <p>{timeAgo(device.last_seen_at)}</p>
        </div>
        <div>
          <span className="font-medium text-foreground">Last sync</span>
          <p>{timeAgo(device.last_sync_at)}</p>
        </div>
        {device.firmware_version && (
          <div>
            <span className="font-medium text-foreground">Firmware</span>
            <p>{device.firmware_version}</p>
          </div>
        )}
        {device.hardware_version && (
          <div>
            <span className="font-medium text-foreground">Hardware</span>
            <p>{device.hardware_version}</p>
          </div>
        )}
      </div>

      {capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {capabilities.map((c) => (
            <Badge key={c} variant="outline" className="text-[10px] px-1 py-0">
              {c}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
