import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  session_id: string | null;
  recording_type: "upload" | "stem" | "master";
  is_public: boolean;
  created_at: string;
}

export type SortOption = "date-desc" | "date-asc" | "duration-desc" | "bpm-desc";

const SORT_MAP: Record<SortOption, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  "date-desc":     { column: "created_at", ascending: false },
  "date-asc":      { column: "created_at", ascending: true },
  "duration-desc": { column: "duration_sec", ascending: false },
  "bpm-desc":      { column: "bpm", ascending: false, nullsFirst: false },
};

export type RecordingType = "upload" | "stem" | "master";

export async function getRecordings({
  limit = 12,
  page = 1,
  query = "",
  sort = "date-desc",
  sessionId,
  type,
}: {
  limit?: number;
  page?: number;
  query?: string;
  sort?: SortOption;
  sessionId?: string;
  type?: RecordingType;
} = {}): Promise<RecordingRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { column, ascending, nullsFirst } = SORT_MAP[sort] ?? SORT_MAP["date-desc"];

  let q = supabase
    .from("recordings")
    .select("*")
    .eq("user_id", user.id)
    .order(column, { ascending, nullsFirst })
    .range((page - 1) * limit, page * limit - 1);

  if (query) {
    q = q.ilike("title", `%${query}%`);
  }

  if (sessionId) {
    q = q.eq("session_id", sessionId);
  }

  if (type) {
    q = q.eq("recording_type", type);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export interface RecordingStats {
  totalCount: number;
  totalMinutes: number;
  byType: Record<RecordingType, number>;
}

/**
 * Totals + per-type breakdown for the recordings hub header. RLS scopes to
 * the caller; one query in, summarized client-side rather than three DB hits.
 */
export async function getRecordingStats(): Promise<RecordingStats> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { totalCount: 0, totalMinutes: 0, byType: { upload: 0, stem: 0, master: 0 } };

  const { data } = await supabase
    .from("recordings")
    .select("recording_type, duration_sec")
    .eq("user_id", user.id);
  const rows = (data ?? []) as { recording_type: RecordingType; duration_sec: number }[];

  const byType: Record<RecordingType, number> = { upload: 0, stem: 0, master: 0 };
  let totalSec = 0;
  for (const r of rows) {
    if (r.recording_type in byType) byType[r.recording_type] += 1;
    totalSec += r.duration_sec ?? 0;
  }
  return {
    totalCount: rows.length,
    totalMinutes: Math.round(totalSec / 60),
    byType,
  };
}

/**
 * Lists publicly-shared recordings across users. Like /captures/explore — goes
 * through the admin client because RLS scopes the authenticated view to the
 * caller's own rows.
 */
export async function listPublicRecordings(opts: {
  limit?: number;
  offset?: number;
} = {}): Promise<RecordingRow[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
  const offset = Math.max(0, opts.offset ?? 0);
  const admin = createAdminClient();
  const { data } = await admin
    .from("recordings")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return (data ?? []) as RecordingRow[];
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

export async function getRecordingsBySessionId(
  sessionId: string,
  userId: string
): Promise<RecordingRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return data ?? [];
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
