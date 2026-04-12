import { createClient } from "@/lib/supabase/server";

export interface AnalyticsSnapshot {
  totalSessions: number;
  totalMinutes: number;
  avgMinutesPerSession: number;
  sessionsByMode: Record<string, number>;
  sessionsByDayOfWeek: number[]; // length 7, index 0 = Sunday
  sessionsByHour: number[]; // length 24
  topVibes: { vibe: string; count: number }[];
  topKits: { kitId: string | null; kitName: string | null; count: number }[];
  sessionsPerDay: { date: string; count: number; minutes: number }[];
  rangeDays: number;
  hasData: boolean;
}

const EMPTY_SNAPSHOT: AnalyticsSnapshot = {
  totalSessions: 0,
  totalMinutes: 0,
  avgMinutesPerSession: 0,
  sessionsByMode: {},
  sessionsByDayOfWeek: Array(7).fill(0),
  sessionsByHour: Array(24).fill(0),
  topVibes: [],
  topKits: [],
  sessionsPerDay: [],
  rangeDays: 0,
  hasData: false,
};

export async function getAnalytics(days = 90): Promise<AnalyticsSnapshot> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...EMPTY_SNAPSHOT, rangeDays: days };

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(
      "started_at, duration_sec, samples_played, loops_recorded, vibes_used, mode, kit_id"
    )
    .eq("user_id", user.id)
    .gte("started_at", since.toISOString());

  if (error) throw error;

  const rows = sessions ?? [];
  if (rows.length === 0) return { ...EMPTY_SNAPSHOT, rangeDays: days };

  const sessionsByMode: Record<string, number> = {};
  const sessionsByDayOfWeek = Array(7).fill(0);
  const sessionsByHour = Array(24).fill(0);
  const vibeCounts = new Map<string, number>();
  const kitCounts = new Map<string, number>();
  const perDay = new Map<string, { count: number; minutes: number }>();

  let totalMinutes = 0;

  for (const s of rows) {
    const started = new Date(s.started_at);
    sessionsByDayOfWeek[started.getUTCDay()] += 1;
    sessionsByHour[started.getUTCHours()] += 1;

    const mode = s.mode ?? "instrument";
    sessionsByMode[mode] = (sessionsByMode[mode] ?? 0) + 1;

    const minutes = Math.round((s.duration_sec ?? 0) / 60);
    totalMinutes += minutes;

    const date = s.started_at.slice(0, 10);
    const prev = perDay.get(date) ?? { count: 0, minutes: 0 };
    prev.count += 1;
    prev.minutes += minutes;
    perDay.set(date, prev);

    const vibes = Array.isArray(s.vibes_used) ? (s.vibes_used as string[]) : [];
    for (const v of vibes) {
      vibeCounts.set(v, (vibeCounts.get(v) ?? 0) + 1);
    }

    if (s.kit_id) {
      kitCounts.set(s.kit_id, (kitCounts.get(s.kit_id) ?? 0) + 1);
    }
  }

  // Resolve kit names for the top kits
  const topKitEntries = Array.from(kitCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  let kitNameMap = new Map<string, string>();
  if (topKitEntries.length > 0) {
    const { data: kitRows } = await supabase
      .from("kits")
      .select("id, name")
      .in(
        "id",
        topKitEntries.map(([id]) => id)
      );
    kitNameMap = new Map((kitRows ?? []).map((k) => [k.id as string, k.name as string]));
  }

  // Densify sessionsPerDay across the full range so the sparkline has uniform bars
  const sessionsPerDay: { date: string; count: number; minutes: number }[] = [];
  const startMs = since.getTime();
  const endMs = Date.now();
  for (let ms = startMs; ms <= endMs; ms += 24 * 60 * 60 * 1000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    const bucket = perDay.get(d) ?? { count: 0, minutes: 0 };
    sessionsPerDay.push({ date: d, ...bucket });
  }

  const topVibes = Array.from(vibeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([vibe, count]) => ({ vibe, count }));

  const topKits = topKitEntries.map(([id, count]) => ({
    kitId: id,
    kitName: kitNameMap.get(id) ?? null,
    count,
  }));

  return {
    totalSessions: rows.length,
    totalMinutes,
    avgMinutesPerSession: Math.round(totalMinutes / Math.max(rows.length, 1)),
    sessionsByMode,
    sessionsByDayOfWeek,
    sessionsByHour,
    topVibes,
    topKits,
    sessionsPerDay,
    rangeDays: days,
    hasData: true,
  };
}
