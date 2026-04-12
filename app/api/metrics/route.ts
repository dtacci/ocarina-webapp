import { createClient } from "@/lib/supabase/server";

export interface MetricsResponse {
  device: {
    lastSeenAt: string | null;
    lastSyncAt: string | null;
    isOnline: boolean;
    isRecent: boolean;
    name: string | null;
  };
  commands: {
    total24h: number;
    responsiveness: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    histogram: Array<{ label: string; minMs: number; maxMs: number; count: number }>;
  };
  uploads: {
    total24h: number;
    total7d: number;
    byDay: Array<{ date: string; stems: number; master: number; uploads: number }>;
  };
  sessions: {
    total7d: number;
    totalMinutes7d: number;
    loopSessions7d: number;
  };
  recentEvents: Array<{
    id: string;
    type: "recording" | "command" | "session";
    label: string;
    detail: string;
    at: string;
    latencyMs?: number;
  }>;
}

const LATENCY_BUCKETS = [
  { label: "< 1s",  minMs: 0,    maxMs: 1000  },
  { label: "1–2s",  minMs: 1000, maxMs: 2000  },
  { label: "2–4s",  minMs: 2000, maxMs: 4000  },
  { label: "4–8s",  minMs: 4000, maxMs: 8000  },
  { label: "≥ 8s",  minMs: 8000, maxMs: Infinity },
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const now = Date.now();
  const ago24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const ago7d  = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Phase 1: Get user's Pi devices (needed for device_commands foreign key filter)
  const { data: deviceRows } = await supabase
    .from("devices")
    .select("id, name, last_seen_at, last_sync_at")
    .eq("user_id", user.id)
    .neq("device_type", "web_browser")
    .order("last_seen_at", { ascending: false, nullsFirst: false });

  const primaryDevice = deviceRows?.[0] ?? null;
  const deviceIds = (deviceRows ?? []).map((d) => d.id);

  // Phase 2: Remaining queries in parallel (react-best-practices: async-parallel)
  const [commandRows, recordingRows, sessionRows,
         recentRecRows, recentCmdRows, recentSessRows] = await Promise.all([
    // Commands with latency (last 24h, consumed only)
    deviceIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from("device_commands")
          .select("created_at, consumed_at, command")
          .in("device_id", deviceIds)
          .not("consumed_at", "is", null)
          .gte("created_at", ago24h),

    // Recordings (last 7 days, for upload chart)
    supabase
      .from("recordings")
      .select("created_at, recording_type")
      .eq("user_id", user.id)
      .gte("created_at", ago7d)
      .order("created_at", { ascending: true }),

    // Sessions (last 7 days)
    supabase
      .from("sessions")
      .select("started_at, duration_sec, mode, loops_recorded")
      .eq("user_id", user.id)
      .gte("started_at", ago7d),

    // Recent recordings for event feed
    supabase
      .from("recordings")
      .select("id, created_at, title, recording_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),

    // Recent commands for event feed
    deviceIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from("device_commands")
          .select("id, created_at, consumed_at, command")
          .in("device_id", deviceIds)
          .not("consumed_at", "is", null)
          .order("created_at", { ascending: false })
          .limit(20),

    // Recent sessions for event feed
    supabase
      .from("sessions")
      .select("id, started_at, mode, loops_recorded")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  // ── Device ─────────────────────────────────────────────────────────────────
  const lastSeenMs = primaryDevice?.last_seen_at
    ? new Date(primaryDevice.last_seen_at).getTime()
    : 0;

  const device: MetricsResponse["device"] = {
    lastSeenAt: primaryDevice?.last_seen_at ?? null,
    lastSyncAt: primaryDevice?.last_sync_at ?? null,
    isOnline: lastSeenMs > now - 2 * 60 * 1000,
    isRecent: lastSeenMs > now - 10 * 60 * 1000,
    name: primaryDevice?.name ?? null,
  };

  // ── Commands ───────────────────────────────────────────────────────────────
  const cmds = commandRows.data ?? [];
  const latencies = cmds
    .map((c) => {
      if (!c.consumed_at || !c.created_at) return null;
      const ms = new Date(c.consumed_at).getTime() - new Date(c.created_at).getTime();
      return ms >= 0 ? ms : null;
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const avgLatencyMs = latencies.length
    ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
    : 0;
  const p95LatencyMs = latencies.length
    ? (latencies[Math.floor(latencies.length * 0.95)] ?? 0)
    : 0;
  const responsiveness = latencies.length
    ? Math.round((latencies.filter((v) => v <= 5000).length / latencies.length) * 100)
    : 100;

  const commands: MetricsResponse["commands"] = {
    total24h: latencies.length,
    responsiveness,
    avgLatencyMs,
    p95LatencyMs,
    histogram: LATENCY_BUCKETS.map(({ label, minMs, maxMs }) => ({
      label, minMs, maxMs,
      count: latencies.filter((v) => v >= minMs && v < maxMs).length,
    })),
  };

  // ── Uploads by day ─────────────────────────────────────────────────────────
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

  const uploads: MetricsResponse["uploads"] = {
    total24h: recs.filter((r) => r.created_at >= ago24h).length,
    total7d: recs.length,
    byDay: Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })),
  };

  // ── Sessions ───────────────────────────────────────────────────────────────
  const sess = sessionRows.data ?? [];
  const sessions: MetricsResponse["sessions"] = {
    total7d: sess.length,
    totalMinutes7d: Math.round(
      sess.reduce((s, r) => s + (r.duration_sec ?? 0), 0) / 60
    ),
    loopSessions7d: sess.filter((r) => r.mode === "looper").length,
  };

  // ── Recent events feed ─────────────────────────────────────────────────────
  const recEvents = (recentRecRows.data ?? []).map((r) => ({
    id: `rec-${r.id}`,
    type: "recording" as const,
    label: r.title ?? "Untitled",
    detail: r.recording_type === "master" ? "Session mix"
          : r.recording_type === "stem"   ? "Stem"
          : "Upload",
    at: r.created_at,
  }));

  const cmdEvents = (recentCmdRows.data ?? []).map((c) => {
    const latMs = c.consumed_at
      ? new Date(c.consumed_at).getTime() - new Date(c.created_at).getTime()
      : undefined;
    return {
      id: `cmd-${c.id}`,
      type: "command" as const,
      label: c.command.replace(/_/g, " "),
      detail: "command",
      at: c.created_at,
      latencyMs: latMs,
    };
  });

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

  return Response.json({ device, commands, uploads, sessions, recentEvents } satisfies MetricsResponse);
}
