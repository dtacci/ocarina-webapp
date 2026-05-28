"use client";

import { Usb, Plug, AlertTriangle, Loader2, Unplug } from "lucide-react";

import type { UseWebSerialTeensy } from "@/hooks/use-web-serial-teensy";

interface Props {
  teensy: UseWebSerialTeensy;
  baudRate: number;
  onBaudChange: (baud: number) => void;
}

/**
 * Status + connect/disconnect controls for talking to a Teensy plugged into
 * this laptop directly. Shown on /monitor when no Pi is paired/online — the
 * user clicks Connect, picks the Teensy from the browser's USB picker, and
 * events stream right through the same monitor panels.
 */
export function TeensyConnectCard({ teensy, baudRate, onBaudChange }: Props) {
  if (!teensy.isSupported) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-amber-400" />
          <div className="space-y-1">
            <div className="text-sm font-medium text-amber-200">
              Direct Teensy connection isn&apos;t supported in this browser
            </div>
            <p className="text-xs text-muted-foreground">
              WebSerial works in Chrome and Edge on desktop. Use one of those
              to plug the Teensy in directly, or pair a Pi to use the regular
              Realtime path.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isBusy = teensy.status === "connecting";
  const isConnected = teensy.status === "connected";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full border bg-card/60">
          <Usb className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            Teensy (direct USB)
            <StatusPill status={teensy.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {isConnected
              ? "Streaming over USB serial. Press buttons or play notes to see events."
              : "No Pi detected. Plug the Teensy into this laptop's USB and connect."}
          </p>
          {teensy.errorMessage && teensy.status === "error" && (
            <p className="mt-1 text-xs text-red-400">{teensy.errorMessage}</p>
          )}
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Baud
          <select
            value={baudRate}
            onChange={(e) => onBaudChange(Number(e.target.value))}
            disabled={isConnected || isBusy}
            className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value={115200}>115200 (main.ino)</option>
            <option value={9600}>9600 (v8)</option>
          </select>
        </label>

        {isConnected ? (
          <button
            type="button"
            onClick={() => { void teensy.disconnect(); }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Unplug className="size-3" />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => { void teensy.connect(); }}
            className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plug className="size-3" />
            )}
            {isBusy ? "Connecting…" : "Connect Teensy"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: UseWebSerialTeensy["status"] }) {
  const color =
    status === "connected" ? "text-emerald-400"
    : status === "connecting" ? "text-amber-400"
    : status === "error" ? "text-red-400"
    : "text-muted-foreground";
  const label =
    status === "connected" ? "connected"
    : status === "connecting" ? "connecting"
    : status === "error" ? "error"
    : status === "unsupported" ? "unsupported"
    : "idle";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wider ${color}`}>
      {label}
    </span>
  );
}
