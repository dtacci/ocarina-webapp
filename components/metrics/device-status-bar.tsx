"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function formatTimeAgo(isoStr: string | null): string {
  if (!isoStr) return "never";
  const s = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

interface Props {
  initialLastSeenAt: string | null;
  initialIsOnline: boolean;
  initialIsRecent: boolean;
  deviceName: string | null;
}

export function DeviceStatusBar({
  initialLastSeenAt,
  initialIsOnline,
  initialIsRecent,
  deviceName,
}: Props) {
  const [lastSeenAt, setLastSeenAt] = useState(initialLastSeenAt);
  const [isOnline, setIsOnline] = useState(initialIsOnline);
  const [isRecent, setIsRecent] = useState(initialIsRecent);
  const [pulse, setPulse] = useState(false);

  // Update time-ago label via DOM mutation to avoid re-renders
  const timeSpanRef = useRef<HTMLSpanElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const update = () => {
      if (timeSpanRef.current) {
        timeSpanRef.current.textContent = formatTimeAgo(lastSeenAt);
      }
      // Recompute online status
      const lastMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
      const now = Date.now();
      setIsOnline(lastMs > now - 2 * 60 * 1000);
      setIsRecent(lastMs > now - 10 * 60 * 1000);
    };
    update();
    intervalRef.current = setInterval(update, 10_000);
    return () => clearInterval(intervalRef.current);
  }, [lastSeenAt]);

  // Realtime: subscribe to devices table updates (heartbeats update last_seen_at)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("metrics_device_heartbeat")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "devices" },
        (payload) => {
          const newLastSeen = (payload.new as Record<string, unknown>).last_seen_at as string | null;
          if (newLastSeen) {
            setLastSeenAt(newLastSeen);
            // Trigger one-shot pulse animation
            setPulse(true);
            setTimeout(() => setPulse(false), 800);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const statusColor = isOnline ? "bg-emerald-500"
    : isRecent ? "bg-amber-400"
    : "bg-red-500";

  const statusLabel = isOnline ? "ONLINE"
    : isRecent ? "RECENTLY ACTIVE"
    : "OFFLINE";

  const statusText = isOnline ? "text-emerald-400"
    : isRecent ? "text-amber-400"
    : "text-red-400";

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border bg-card/95 backdrop-blur-sm px-4 py-2.5 text-xs">
      {/* Animated status dot */}
      <div className="relative flex size-2 shrink-0">
        <span
          className={[
            "absolute inline-flex size-full rounded-full opacity-75",
            statusColor,
            isOnline ? "animate-ping" : "",
            pulse ? "scale-150 opacity-100" : "",
          ].join(" ")}
          style={{ transition: pulse ? "transform 0.15s ease-out, opacity 0.15s" : "" }}
        />
        <span className={`relative inline-flex size-2 rounded-full ${statusColor}`} />
      </div>

      <span className={`font-mono font-semibold tracking-widest ${statusText}`}>
        {statusLabel}
      </span>

      {deviceName && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground font-medium">{deviceName}</span>
        </>
      )}

      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        Last seen <span ref={timeSpanRef}>{formatTimeAgo(lastSeenAt)}</span>
      </span>

      {!deviceName && (
        <>
          <span className="text-muted-foreground">·</span>
          <a href="/devices" className="text-primary hover:underline">
            Register a device →
          </a>
        </>
      )}
    </div>
  );
}
