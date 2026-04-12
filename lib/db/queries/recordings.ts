import { createClient } from "@/lib/supabase/server";

export interface RecordingRow {
  id: string;
  user_id: string;
  device_id: string | null;
  title: string;
  blob_url: string;
  duration_sec: number;
  sample_rate: number;
  bpm: number | null;
  kit_id: string | null;
  is_public: boolean;
  created_at: string;
}

export async function getRecordings(limit = 20): Promise<RecordingRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getPublicRecording(id: string): Promise<RecordingRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (error) return null;
  return data;
}
