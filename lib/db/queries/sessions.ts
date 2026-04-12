import { createClient } from "@/lib/supabase/server";

export interface SessionRow {
  id: string;
  user_id: string;
  device_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  kit_id: string | null;
  samples_played: number;
  loops_recorded: number;
  vibes_used: string[];
  mode: string;
  metadata: Record<string, unknown> | null;
}

export interface DayActivity {
  date: string; // YYYY-MM-DD
  count: number;
  minutes: number;
}

export async function getRecentSessions(limit = 20): Promise<SessionRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getActivityHeatmap(): Promise<DayActivity[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get last 365 days of sessions
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const { data, error } = await supabase
    .from("sessions")
    .select("started_at, duration_sec")
    .eq("user_id", user.id)
    .gte("started_at", yearAgo.toISOString())
    .order("started_at", { ascending: true });

  if (error) throw error;

  // Aggregate by day
  const dayMap = new Map<string, { count: number; minutes: number }>();
  for (const session of data ?? []) {
    const date = session.started_at.slice(0, 10); // YYYY-MM-DD
    const existing = dayMap.get(date) ?? { count: 0, minutes: 0 };
    existing.count += 1;
    existing.minutes += Math.round((session.duration_sec ?? 0) / 60);
    dayMap.set(date, existing);
  }

  return Array.from(dayMap.entries()).map(([date, { count, minutes }]) => ({
    date,
    count,
    minutes,
  }));
}

export async function getSessionStats(): Promise<{
  totalSessions: number;
  totalMinutes: number;
  samplesPlayed: number;
  loopsRecorded: number;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { totalSessions: 0, totalMinutes: 0, samplesPlayed: 0, loopsRecorded: 0 };

  const { data, error } = await supabase
    .from("sessions")
    .select("duration_sec, samples_played, loops_recorded")
    .eq("user_id", user.id);

  if (error) throw error;

  const sessions = data ?? [];
  return {
    totalSessions: sessions.length,
    totalMinutes: sessions.reduce((sum, s) => sum + Math.round((s.duration_sec ?? 0) / 60), 0),
    samplesPlayed: sessions.reduce((sum, s) => sum + (s.samples_played ?? 0), 0),
    loopsRecorded: sessions.reduce((sum, s) => sum + (s.loops_recorded ?? 0), 0),
  };
}
