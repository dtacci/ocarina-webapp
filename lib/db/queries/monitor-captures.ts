import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MonitorCaptureRow {
  id: string;
  user_id: string;
  device_id: string | null;
  name: string;
  blob_url: string;
  blob_pathname: string;
  source: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  event_count: number;
  button_event_count: number;
  note_event_count: number;
  fx_event_count: number;
  heartbeat_count: number;
  loop_event_count: number;
  gpio_event_count: number;
  misc_event_count: number;
  notes: string | null;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
}

/** Lists the caller's captures, newest first. */
export async function listMyCaptures(limit = 50): Promise<MonitorCaptureRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("monitor_captures")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listMyCaptures", error);
    return [];
  }
  return (data ?? []) as MonitorCaptureRow[];
}

/**
 * Looks up a publicly-shared capture by its share token. Bypasses RLS via the
 * admin client and double-checks `is_public` server-side — even if a token
 * leaks, owners can revoke access by toggling the share off.
 */
export async function getPublicCaptureByToken(
  token: string
): Promise<MonitorCaptureRow | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("monitor_captures")
    .select("*")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();
  return (data ?? null) as MonitorCaptureRow | null;
}

export async function getMyCapture(id: string): Promise<MonitorCaptureRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("monitor_captures")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (data ?? null) as MonitorCaptureRow | null;
}

export interface CaptureDayActivity {
  date: string; // YYYY-MM-DD
  count: number;
  minutes: number;
}

/** Per-day capture activity over the last 365 days — feeds the activity heatmap. */
export async function getCapturesHeatmap(): Promise<CaptureDayActivity[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const { data, error } = await supabase
    .from("monitor_captures")
    .select("created_at, duration_ms")
    .eq("user_id", user.id)
    .gte("created_at", yearAgo.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getCapturesHeatmap", error);
    return [];
  }

  const dayMap = new Map<string, { count: number; minutes: number }>();
  for (const row of (data ?? []) as { created_at: string; duration_ms: number }[]) {
    const date = row.created_at.slice(0, 10);
    const existing = dayMap.get(date) ?? { count: 0, minutes: 0 };
    existing.count += 1;
    existing.minutes += Math.round(row.duration_ms / 60_000);
    dayMap.set(date, existing);
  }
  return Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));
}

/** Total saved-capture count for the caller. Used in stats card. */
export async function getCapturesCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("monitor_captures")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  return count ?? 0;
}
