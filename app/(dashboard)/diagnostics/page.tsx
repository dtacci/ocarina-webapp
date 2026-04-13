import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DeviceStatusBar } from "@/components/diagnostics/device-status-bar";
import { StatsGrid } from "@/components/diagnostics/stats-grid";
import { UploadChart } from "@/components/diagnostics/upload-chart";
import { LatencyChart } from "@/components/diagnostics/latency-chart";
import { EventsFeed } from "@/components/diagnostics/events-feed";
import type { MetricsResponse } from "@/app/api/diagnostics/route";

async function getMetrics(userId: string): Promise<MetricsResponse> {
  const supabase = await createClient();
  const now = Date.now();
  const ago24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const ago7d  = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get Pi devices
  const { data: deviceRows } = await supabase
    .from("devices")
    .select("id, name, last_seen_at, last_sync_at")
    .eq("user_id", userId)
    .neq("device_type", "web_browser")
    .order("last_seen_at", { ascending: false, nullsFirst: false });

  const primaryDevice = deviceRows?.[0] ?? null;
  const deviceIds = (deviceRows ?? []).map((d) => d.id);
  const lastSeenMs = primaryDevice?.last_seen_at
    ? new Date(primaryDevice.last_seen_at).getTime()
    : 0;

  const [commandRows, recordingRows, sessionRows, recentRecRows, recentCmdRows, recentSessRows] =
    await Promise.all([
      deviceIds.length === 0
        ? Promise.resolve({ data: [] as Array<{ created_at: string; consumed_at: string | null; command: string }> })
        : supabase
            .from("device_commands")
            .select("created_at, consumed_at, command")
            .in("device_id", deviceIds)
            .not("consumed_at", "is", null)
            .gte("created_at", ago24h)
            .then((r) => ({ data: r.data ?? [] })),

      supabase
        .from("recordings")
        .select("created_at, recording_type")
        .eq("user_id", userId)
        .gte("created_at", ago7d)
        .order("created_at", { ascending: true })
        .then((r) => ({ data: r.data ?? [] })),

      supabase
        .from("sessions")
        .select("started_at, duration_sec, mode, loops_recorded")
        .eq("user_id", userId)
        .gte("started_at", ago7d)
        .then((r) => ({ data: r.data ?? [] })),

      supabase
        .from("recordings")
        .select("id, created_at, title, recording_type")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)
        .then((r) => ({ data: r.data ?? [] })),

      deviceIds.length === 0
        ? Promise.resolve({ data: [] as Array<{ id: string; created_at: string; consumed_at: string | null; command: string }> })
        : supabase
            .from("device_commands")
            .select("id, created_at, consumed_at, command")
            .in("device_id", deviceIds)
            .not("consumed_at", "is", null)
            .order("created_at", { ascending: false })
            .limit(20)
            .then((r) => ({ data: r.data ?? [] })),

      supabase
        .from("sessions")
        .select("id, started_at, mode, loops_recorded")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(10)
        .then((r) => ({ data: r.data ?? [] })),
    ]);

  // Compute latency metrics
  const latencies = (commandRows.data ?? [])
    .map((c) => {
      if (!c.consumed_at) return null;
      const ms = new Date(c.consumed_at).getTime() - new Date(c.created_at).getTime();
      return ms >= 0 ? ms : null;
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const BUCKETS = [
    { label: "< 1s", minMs: 0, maxMs: 1000 },
    { label: "1–2s", minMs: 1000, maxMs: 2000 },
    { label: "2–4s", minMs: 2000, maxMs: 4000 },
    { label: "4–8s", minMs: 4000, maxMs: 8000 },
    { label: "≥ 8s", minMs: 8000, maxMs: Infinity },
  ];

  // Upload by day
  const recs = recordingRows.data ?? [];
  const dayMap = new Map<string, { stems: number; master: number; uploads: number }>();
  for (let d = 6; d >= 0; d--) {
    const day = new Date(now - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dayMap.set(day, { stems: 0, master: 0, uploads: 0 });
  }
  for (const r of recs) {
    const day = r.created_at.slice(0, 10);
    const slot = dayMap.get(day);
    if (!slot) continue;
    if (r.recording_type === "stem") slot.stems++;
    else if (r.recording_type === "master") slot.master++;
    else slot.uploads++;
  }

  // Recent events
  const recEvents = (recentRecRows.data ?? []).map((r) => ({
    id: `rec-${r.id}`,
    type: "recording" as const,
    label: r.title ?? "Untitled",
    detail: r.recording_type === "master" ? "Session mix" : r.recording_type === "stem" ? "Stem" : "Upload",
    at: r.created_at,
  }));
  const cmdEvents = (recentCmdRows.data ?? []).map((c) => ({
    id: `cmd-${c.id}`,
    type: "command" as const,
    label: c.command.replace(/_/g, " "),
    detail: "command",
    at: c.created_at,
    latencyMs: c.consumed_at
      ? new Date(c.consumed_at).getTime() - new Date(c.created_at).getTime()
      : undefined,
  }));
  const sessEvents = (recentSessRows.data ?? []).map((s) => ({
    id: `sess-${s.id}`,
    type: "session" as const,
    label: `${s.mode ?? "instrument"} session`,
    detail: (s.loops_recorded ?? 0) > 0 ? `${s.loops_recorded} loops` : "",
    at: s.started_at,
  }));
  const recentEvents = [...recEvents, ...cmdEvents, ...sessEvents]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 30);

  const sess = sessionRows.data ?? [];

  return {
    device: {
      lastSeenAt: primaryDevice?.last_seen_at ?? null,
      lastSyncAt: primaryDevice?.last_sync_at ?? null,
      isOnline: lastSeenMs > now - 2 * 60 * 1000,
      isRecent: lastSeenMs > now - 10 * 60 * 1000,
      name: primaryDevice?.name ?? null,
    },
    commands: {
      total24h: latencies.length,
      responsiveness: latencies.length
        ? Math.round((latencies.filter((v) => v <= 5000).length / latencies.length) * 100)
        : 100,
      avgLatencyMs: latencies.length
        ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
        : 0,
      p95LatencyMs: latencies.length
        ? (latencies[Math.floor(latencies.length * 0.95)] ?? 0)
        : 0,
      histogram: BUCKETS.map(({ label, minMs, maxMs }) => ({
        label, minMs, maxMs,
        count: latencies.filter((v) => v >= minMs && v < maxMs).length,
      })),
    },
    uploads: {
      total24h: recs.filter((r) => r.created_at >= ago24h).length,
      total7d: recs.length,
      byDay: Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })),
    },
    sessions: {
      total7d: sess.length,
      totalMinutes7d: Math.round(sess.reduce((s, r) => s + (r.duration_sec ?? 0), 0) / 60),
      loopSessions7d: sess.filter((r) => r.mode === "looper").length,
    },
    recentEvents,
  };
}

export default async function MetricsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Sign in to view metrics</p>
      </div>
    );
  }

  const metrics = await getMetrics(user.id);

  // Get device IDs for the events feed Realtime filter
  const { data: deviceRows } = await supabase
    .from("devices")
    .select("id")
    .eq("user_id", user.id)
    .neq("device_type", "web_browser");
  const deviceIds = (deviceRows ?? []).map((d) => d.id);

  // Latency history for sparkline (last 20 command latencies, oldest first)
  const latencyHistory = metrics.commands.histogram
    .flatMap((b) => Array(Math.min(b.count, 5)).fill(b.minMs + (b.maxMs - b.minMs) / 2))
    .slice(0, 20);

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Metrics</h1>
        <p className="text-muted-foreground text-sm">
          Sync health, upload activity, and command latency — all from existing data.
        </p>
      </div>

      {/* Live status bar */}
      <DeviceStatusBar
        initialLastSeenAt={metrics.device.lastSeenAt}
        initialIsOnline={metrics.device.isOnline}
        initialIsRecent={metrics.device.isRecent}
        deviceName={metrics.device.name}
      />

      {/* Stat cards */}
      <Suspense fallback={<div className="h-28 rounded-xl border bg-card/50 animate-pulse" />}>
        <StatsGrid
          commands={metrics.commands}
          uploads={metrics.uploads}
          sessions={metrics.sessions}
          latencyHistory={latencyHistory}
        />
      </Suspense>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <UploadChart byDay={metrics.uploads.byDay} />
        <LatencyChart
          histogram={metrics.commands.histogram}
          totalCommands={metrics.commands.total24h}
        />
      </div>

      {/* Live events feed */}
      <EventsFeed
        initialEvents={metrics.recentEvents}
        userId={user.id}
        deviceIds={deviceIds}
      />
    </div>
  );
}
