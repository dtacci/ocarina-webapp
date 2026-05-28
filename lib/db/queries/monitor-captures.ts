import { createClient } from "@/lib/supabase/server";

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
