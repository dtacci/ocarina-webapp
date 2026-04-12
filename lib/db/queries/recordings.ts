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
  waveform_peaks: number[] | null;
  is_public: boolean;
  created_at: string;
}

export async function getRecordings({
  limit = 12,
  page = 1,
  query = "",
}: { limit?: number; page?: number; query?: string } = {}): Promise<RecordingRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let q = supabase
    .from("recordings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (query) {
    q = q.ilike("title", `%${query}%`);
  }

  const { data, error } = await q;
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

export async function getRecordingById(
  id: string,
  userId: string
): Promise<RecordingRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
}

export async function updateRecording(
  id: string,
  userId: string,
  data: Partial<{ title: string; is_public: boolean; bpm: number | null }>
): Promise<RecordingRow | null> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("recordings")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return null;
  return updated;
}

export async function deleteRecording(
  id: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("recordings")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}
