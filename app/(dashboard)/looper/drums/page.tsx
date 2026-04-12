import Link from "next/link";
import { getDevices } from "@/lib/db/queries/devices";
import { DrumMachine } from "@/components/looper/drum-machine";

export default async function DrumsPage() {
  const devices = await getDevices();
  const piDevice = devices.find(
    (d) => d.capabilities?.looper && d.device_type !== "web_browser"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drum Machine</h1>
          <p className="text-muted-foreground">
            Step sequencer companion for the looper — keyboard, hardware, or touch-friendly on your phone.
          </p>
        </div>
        {!piDevice && (
          <Link
            href="/devices"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Connect a device to lock tempo with the looper →
          </Link>
        )}
      </div>

      <DrumMachine
        deviceId={piDevice?.id ?? null}
        deviceName={piDevice?.name ?? "This Browser"}
      />
    </div>
  );
}
