"use client";

import { useCallback } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useLoopState } from "@/hooks/use-loop-state";
import { TrackBlock } from "./track-block";
import { BpmDisplay } from "./bpm-display";

interface Props {
  deviceId: string;
  deviceName: string;
}

async function sendCommand(deviceId: string, command: string, params: Record<string, unknown> = {}) {
  await fetch("/api/sync/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, command, params }),
  });
}

export function LooperDashboard({ deviceId, deviceName }: Props) {
  const { loopState, status, lastUpdated } = useLoopState(deviceId);

  const handleMuteToggle = useCallback((trackId: number) => {
    const track = loopState.tracks.find((t) => t.id === trackId);
    const command = track?.muted ? "unmute_track" : "mute_track";
    sendCommand(deviceId, command, { track: trackId });
  }, [deviceId, loopState.tracks]);

  const handleRecord = useCallback((trackId: number) => {
    sendCommand(deviceId, "record_track", { track: trackId });
  }, [deviceId]);

  const handleTapTempo = useCallback((bpm: number) => {
    sendCommand(deviceId, "set_bpm", { bpm });
  }, [deviceId]);

  const handleStopAll = useCallback(() => {
    sendCommand(deviceId, "stop_all");
  }, [deviceId]);

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          {status === "connecting" && (
            <Loader2 className="size-4 text-muted-foreground animate-spin" />
          )}
          {status === "connected" && (
            <Wifi className="size-4 text-emerald-500" />
          )}
          {status === "disconnected" && (
            <WifiOff className="size-4 text-muted-foreground/50" />
          )}
          <span className="text-sm font-medium">{deviceName}</span>
          <span className="text-xs text-muted-foreground">
            {status === "connected" && lastUpdated
              ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
              : status === "connecting"
              ? "Connecting…"
              : "Waiting for device signal"}
          </span>
        </div>

        <button
          onClick={handleStopAll}
          className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-destructive/50 hover:text-destructive transition-colors"
        >
          Stop All
        </button>
      </div>

      {/* BPM + master loop */}
      <div className="rounded-lg border bg-card px-5 py-4">
        <BpmDisplay
          bpm={loopState.bpm}
          masterLengthMs={loopState.master_length_ms}
          onTapTempo={handleTapTempo}
        />
      </div>

      {/* Track rows */}
      <div className="space-y-2">
        {loopState.tracks.map((track) => (
          <TrackBlock
            key={track.id}
            track={track}
            masterLengthMs={loopState.master_length_ms}
            isActive={track.id === loopState.active_track}
            onMuteToggle={handleMuteToggle}
            onRecord={handleRecord}
          />
        ))}
      </div>

      {status === "disconnected" && (
        <p className="text-center text-xs text-muted-foreground pt-2">
          Start your Ocarina and ensure the sync agent is running to see live track state.
        </p>
      )}
    </div>
  );
}
