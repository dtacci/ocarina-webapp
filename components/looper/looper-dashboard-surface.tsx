"use client";

import { usePiRestTeensy } from "@/hooks/use-pi-rest-teensy";

import { PiRestStatusCard } from "@/components/monitor/pi-rest-status-card";
import { LoopStatePanel } from "@/components/looper/loop-state-panel";

export function LooperDashboardSurface() {
  const piRest = usePiRestTeensy({ enabled: true });

  return (
    <div className="space-y-4">
      <PiRestStatusCard piRest={piRest} />
      <LoopStatePanel
        snapshot={piRest.loopSnapshot}
        progress={piRest.loopProgress}
        teensyConnected={piRest.teensyConnected}
      />
    </div>
  );
}
