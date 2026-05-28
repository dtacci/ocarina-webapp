"use client";

import { useCallback, useState } from "react";

import { usePiRestTeensy } from "@/hooks/use-pi-rest-teensy";
import { ocarina } from "@/lib/ocarina-api";

import { PiRestStatusCard } from "@/components/monitor/pi-rest-status-card";
import { LoopStatePanel } from "@/components/looper/loop-state-panel";
import { LoopTransportControls } from "@/components/looper/loop-transport-controls";
import { LooperHotkeys } from "@/components/looper/looper-hotkeys";
import { LooperHotkeysHelp } from "@/components/looper/looper-hotkeys-help";

export function LooperDashboardSurface() {
  const piRest = usePiRestTeensy({ enabled: true });
  const [helpOpen, setHelpOpen] = useState(false);

  // Hotkeys → fire-and-forget. Errors surface in the transport's error banner
  // via the next click; keyboard-driven 503s are quiet by design.
  const sim = useCallback((key: string) => {
    void ocarina.simKey(key).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <PiRestStatusCard piRest={piRest} />

      <div className="flex justify-end">
        <LooperHotkeysHelp open={helpOpen} onOpenChange={setHelpOpen} />
      </div>

      <LoopTransportControls snapshot={piRest.loopSnapshot} />
      <LoopStatePanel
        snapshot={piRest.loopSnapshot}
        progress={piRest.loopProgress}
        teensyConnected={piRest.teensyConnected}
      />

      <LooperHotkeys onSim={sim} onHelp={() => setHelpOpen(true)} />
    </div>
  );
}
