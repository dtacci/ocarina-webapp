"use client";

import { Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";

import type { UsePiRestTeensy } from "@/hooks/use-pi-rest-teensy";
import { getOcarinaApiBase } from "@/lib/ocarina-api";

interface Props {
  piRest: UsePiRestTeensy;
}

/**
 * Connection status banner for the Pi-REST transport. No connect button —
 * the hook auto-connects when NEXT_PUBLIC_OCARINA_API is set and handles
 * exponential reconnect on close. This card just surfaces the state.
 */
export function PiRestStatusCard({ piRest }: Props) {
  const { status, errorMessage, buttonStatus } = piRest;
  const base = getOcarinaApiBase();
  const hostLabel = base ? hostFromUrl(base) : "—";

  const tone = toneFor(status);

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
          <div className="text-xs text-muted-foreground">
            <span className="font-mono">{hostLabel}</span>
            {buttonStatus?.buttons && (
              <>
                <span className="mx-1.5">·</span>
                <span>{buttonStatus.buttons.length} buttons mapped</span>
              </>
            )}
          </div>
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
