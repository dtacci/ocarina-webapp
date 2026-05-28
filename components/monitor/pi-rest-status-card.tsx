"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";

import type { UsePiRestTeensy } from "@/hooks/use-pi-rest-teensy";
import { getOcarinaApiBase } from "@/lib/ocarina-api";
import { LatencySparkline } from "@/components/monitor/latency-sparkline";

interface Props {
  piRest: UsePiRestTeensy;
}

/**
 * Connection status banner for the Pi-REST transport. No connect button —
 * the hook auto-connects when NEXT_PUBLIC_OCARINA_API is set and handles
 * exponential reconnect on close. This card just surfaces the state.
 */
export function PiRestStatusCard({ piRest }: Props) {
  const {
    status,
    errorMessage,
    buttonStatus,
    lastHeartbeatAt,
    teensyLatencyMs,
    teensyLatencyHistory,
    version,
    teensyConnected,
  } = piRest;
  const base = getOcarinaApiBase();
  const hostLabel = base ? hostFromUrl(base) : "—";

  const tone = toneFor(status);

  // Re-tick once per second while connected so the "last hb Ns ago" stays fresh
  // without forcing the parent hook to re-render. Skip when disconnected — the
  // number's meaningless then.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "connected") return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [status]);

  const hbAgeS =
    lastHeartbeatAt && status === "connected"
      ? Math.max(0, (nowTick - lastHeartbeatAt) / 1000)
      : null;
  const hbStale = hbAgeS !== null && hbAgeS > 3;

  return (
    <div className={`rounded-xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex size-9 items-center justify-center rounded-full ${tone.iconBg}`}>
          {status === "connected" ? (
            <Wifi className={`size-4 ${tone.icon}`} />
          ) : status === "connecting" ? (
            <Loader2 className={`size-4 animate-spin ${tone.icon}`} />
          ) : status === "error" ? (
            <AlertTriangle className={`size-4 ${tone.icon}`} />
          ) : (
            <WifiOff className={`size-4 ${tone.icon}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            Ocarina API
            <span className={`font-mono text-[10px] uppercase tracking-wider ${tone.icon}`}>
              {status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{hostLabel}</span>
            {buttonStatus?.buttons && (
              <>
                <span>·</span>
                <span>{buttonStatus.buttons.length} buttons</span>
              </>
            )}
            {teensyLatencyMs !== null && (
              <>
                <span>·</span>
                <span
                  className="inline-flex items-center gap-1.5 font-mono tabular-nums"
                  title={`Pi → Teensy round-trip (last ${teensyLatencyHistory.length} samples, polled every 15s)`}
                >
                  Δ {Math.round(teensyLatencyMs)}ms
                  {teensyLatencyHistory.length >= 2 && (
                    <LatencySparkline samples={teensyLatencyHistory} />
                  )}
                </span>
              </>
            )}
            {hbAgeS !== null && (
              <>
                <span>·</span>
                <span
                  className={`font-mono tabular-nums ${hbStale ? "text-amber-400" : ""}`}
                  title="Time since the last /events heartbeat arrived"
                >
                  hb {hbAgeS < 10 ? hbAgeS.toFixed(1) : Math.round(hbAgeS)}s
                </span>
              </>
            )}
          </div>
          {version && (
            <p
              className="mt-0.5 font-mono text-[10px] text-muted-foreground/60"
              title={`branch ${version.git_branch}${version.git_dirty ? " (dirty)" : ""} · uptime ${Math.round(version.uptime_s)}s`}
            >
              Pi v{version.api_version} · {version.git_sha.slice(0, 7)}
              {version.git_dirty ? "*" : ""} · firmware {version.firmware.build_date}
            </p>
          )}
          {teensyConnected === false && (
            <p className="mt-1 text-xs text-red-300">
              Teensy disconnected — note / heartbeat / loop events have
              stopped. Reconnect is automatic when it returns.
            </p>
          )}
          {errorMessage && (status === "error" || status === "disconnected") && (
            <p className="mt-1 text-xs text-muted-foreground/80">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function toneFor(status: UsePiRestTeensy["status"]) {
  switch (status) {
    case "connected":
      return {
        border: "border-emerald-500/40",
        bg: "bg-emerald-500/5",
        iconBg: "bg-emerald-500/15",
        icon: "text-emerald-400",
      };
    case "connecting":
      return {
        border: "border-amber-500/40",
        bg: "bg-amber-500/5",
        iconBg: "bg-amber-500/15",
        icon: "text-amber-400",
      };
    case "error":
      return {
        border: "border-red-500/40",
        bg: "bg-red-500/5",
        iconBg: "bg-red-500/15",
        icon: "text-red-400",
      };
    case "disabled":
    case "disconnected":
    default:
      return {
        border: "border-border",
        bg: "bg-card/60",
        iconBg: "bg-card",
        icon: "text-muted-foreground",
      };
  }
}
