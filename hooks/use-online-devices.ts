"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface OnlineDeviceState {
  onlineDeviceId: string | null;
  onlineDeviceName: string | null;
  lastSeenAt: string | null;
}

const EMPTY: OnlineDeviceState = {
  onlineDeviceId: null,
  onlineDeviceName: null,
  lastSeenAt: null,
};

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const REVALIDATE_INTERVAL_MS = 10_000;

/**
 * Tracks whether any non-browser device is currently online (heartbeat within
 * the last 2 minutes). Used by the sidebar to conditionally render the Live
 * Console entry when there's actually something to debug.
 *
 * Combines two signals:
 *   1. Realtime postgres-changes UPDATE on the `devices` table — fires when
 *      the Pi heartbeats.
 *   2. A setInterval that re-evaluates the 2-min window — required because
 *      no UPDATE fires when heartbeats stop, so without polling the sidebar
 *      would never hide.
 */
export function useOnlineDevices(): OnlineDeviceState {
  const [state, setState] = useState<OnlineDeviceState>(EMPTY);
  const latestRef = useRef<OnlineDeviceState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function refresh() {
      const { data: user } = await supabase.auth.getUser();
      if (cancelled || !user?.user) return;
      const { data: rows } = await supabase
        .from("devices")
        .select("id, name, last_seen_at, device_type")
        .eq("user_id", user.user.id)
        .neq("device_type", "web_browser")
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .limit(1);
      const primary = rows?.[0];
      const seen = primary?.last_seen_at ? new Date(primary.last_seen_at).getTime() : 0;
      const isOnline = seen > Date.now() - ONLINE_WINDOW_MS;
      const next: OnlineDeviceState = isOnline && primary
        ? {
            onlineDeviceId: primary.id as string,
            onlineDeviceName: (primary.name as string) ?? null,
            lastSeenAt: (primary.last_seen_at as string) ?? null,
          }
        : EMPTY;
      if (!sameState(latestRef.current, next)) {
        latestRef.current = next;
        setState(next);
      }
    }

    // Initial load
    refresh();

    // Realtime UPDATE subscription — fires when the Pi heartbeats.
    const channel = supabase
      .channel("sidebar_devices_presence")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "devices" },
        () => {
          refresh();
        }
      )
      .subscribe();

    // Window revalidation — hides the entry when heartbeats stop.
    const iv = setInterval(() => {
      const { lastSeenAt } = latestRef.current;
      if (!lastSeenAt) {
        refresh();
        return;
      }
      const seen = new Date(lastSeenAt).getTime();
      const isOnline = seen > Date.now() - ONLINE_WINDOW_MS;
      if (!isOnline && latestRef.current.onlineDeviceId) {
        latestRef.current = EMPTY;
        setState(EMPTY);
      }
    }, REVALIDATE_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
}

function sameState(a: OnlineDeviceState, b: OnlineDeviceState): boolean {
  return (
    a.onlineDeviceId === b.onlineDeviceId &&
    a.onlineDeviceName === b.onlineDeviceName &&
    a.lastSeenAt === b.lastSeenAt
  );
}
