"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Disc3, Terminal, Activity, Pause, Play } from "lucide-react";
import type { MetricsResponse } from "@/app/api/metrics/route";

type FeedEvent = MetricsResponse["recentEvents"][number] & { isNew?: boolean };

function formatTimeAgo(isoStr: string): string {
  const s = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(isoStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EventIcon({ type }: { type: FeedEvent["type"] }) {
  if (type === "recording") return <Disc3 className="size-3.5 text-emerald-500" />;
  if (type === "command")   return <Terminal className="size-3.5 text-blue-400" />;
  return <Activity className="size-3.5 text-violet-400" />;
}

interface Props {
  initialEvents: FeedEvent[];
  userId: string | null;
  deviceIds: string[];
}

export function EventsFeed({ initialEvents, userId, deviceIds }: Props) {
  const [events, setEvents] = useState<FeedEvent[]>(initialEvents);
  const [paused, setPaused] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const queueRef = useRef<FeedEvent[]>([]);
  const pausedRef = useRef(false);

  // Time-ago labels updated via DOM to avoid re-renders
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const spans = containerRef.current.querySelectorAll<HTMLSpanElement>("[data-event-time]");
      spans.forEach((span) => {
        const iso = span.dataset.eventTime;
        if (iso) span.textContent = formatTimeAgo(iso);
      });
    };
    const id = setInterval(update, 15_000);
    return () => clearInterval(id);
  }, []);

  const addEvent = useCallback((event: FeedEvent) => {
    if (pausedRef.current) {
      queueRef.current.unshift(event);
      setQueuedCount((n) => n + 1);
      return;
    }
    setEvents((prev) => {
      const withNew = [{ ...event, isNew: true }, ...prev].slice(0, 50);
      // Remove isNew flag after animation
      setTimeout(() => {
        setEvents((curr) =>
          curr.map((e) => (e.id === event.id ? { ...e, isNew: false } : e))
        );
      }, 2500);
      return withNew;
    });
  }, []);

  // Supabase Realtime subscriptions
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // New recordings
    const recChannel = supabase
      .channel("metrics_feed_recordings")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "recordings",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const r = payload.new as Record<string, unknown>;
        addEvent({
          id: `rec-${r.id}`,
          type: "recording",
          label: (r.title as string) ?? "Untitled",
          detail: r.recording_type === "master" ? "Session mix"
                : r.recording_type === "stem" ? "Stem" : "Upload",
          at: r.created_at as string,
        });
      })
      .subscribe();
    channels.push(recChannel);

    // Commands consumed
    if (deviceIds.length > 0) {
      const cmdChannel = supabase
        .channel("metrics_feed_commands")
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "device_commands",
        }, (payload) => {
          const c = payload.new as Record<string, unknown>;
          if (!c.consumed_at || !deviceIds.includes(c.device_id as string)) return;
          const latMs = c.consumed_at && c.created_at
            ? new Date(c.consumed_at as string).getTime() - new Date(c.created_at as string).getTime()
            : undefined;
          addEvent({
            id: `cmd-${c.id}`,
            type: "command",
            label: (c.command as string).replace(/_/g, " "),
            detail: "command",
            at: c.created_at as string,
            latencyMs: latMs,
          });
        })
        .subscribe();
      channels.push(cmdChannel);
    }

    // New sessions
    const sessChannel = supabase
      .channel("metrics_feed_sessions")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "sessions",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const s = payload.new as Record<string, unknown>;
        addEvent({
          id: `sess-${s.id}`,
          type: "session",
          label: `${s.mode ?? "instrument"} session`,
          detail: (s.loops_recorded as number) > 0 ? `${s.loops_recorded} loops` : "",
          at: s.started_at as string,
        });
      })
      .subscribe();
    channels.push(sessChannel);

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userId, deviceIds, addEvent]);

  function handlePauseToggle() {
    const nextPaused = !paused;
    pausedRef.current = nextPaused;
    setPaused(nextPaused);

    if (!nextPaused && queueRef.current.length > 0) {
      // Flush queued events
      const queued = [...queueRef.current];
      queueRef.current = [];
      setQueuedCount(0);
      setEvents((prev) => {
        const merged = [...queued, ...prev].slice(0, 50);
        return merged.map((e, i) => i < queued.length ? { ...e, isNew: true } : e);
      });
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Feed header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/10">
        <h2 className="text-sm font-medium">Recent activity</h2>
        <div className="flex items-center gap-3">
          {queuedCount > 0 && (
            <span className="text-xs text-amber-400 font-medium">
              {queuedCount} queued
            </span>
          )}
          <button
            onClick={handlePauseToggle}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={paused ? "Resume live feed" : "Pause live feed"}
          >
            {paused ? (
              <>
                <Play className="size-3" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span>LIVE</span>
                <Pause className="size-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Events list */}
      <div ref={containerRef} className="divide-y max-h-80 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No recent activity
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              data-new={event.isNew ? "true" : undefined}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors"
              style={{
                backgroundColor: event.isNew ? "oklch(0.8 0.15 80 / 0.08)" : "transparent",
                transition: "background-color 2.5s ease-out",
              }}
            >
              <EventIcon type={event.type} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{event.label}</span>
                {event.detail && (
                  <span className="ml-2 text-xs text-muted-foreground">{event.detail}</span>
                )}
              </div>
              {event.latencyMs !== undefined && event.latencyMs > 0 && (
                <span className={`text-xs tabular-nums shrink-0 px-1.5 py-0.5 rounded text-xs ${
                  event.latencyMs < 3000 ? "bg-emerald-500/10 text-emerald-400"
                  : event.latencyMs < 6000 ? "bg-amber-500/10 text-amber-400"
                  : "bg-red-500/10 text-red-400"
                }`}>
                  {(event.latencyMs / 1000).toFixed(1)}s
                </span>
              )}
              <span
                data-event-time={event.at}
                className="text-xs text-muted-foreground/60 shrink-0 w-14 text-right"
              >
                {formatTimeAgo(event.at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
