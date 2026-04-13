import { createClient } from "@/lib/supabase/server";

/** Draft = a user recording that hasn't been polished into a library sample yet. */
export interface DraftRow {
  id: string;
  title: string | null;
  blob_url: string;
  duration_sec: number;
  sample_rate: number;
  waveform_peaks: number[] | null;
  recording_type: "upload" | "stem" | "master";
  created_at: string;
}

/** User-owned sample saved to the library. */
export interface UserSampleRow {
  id: string;
  blob_url: string;
  mp3_blob_url: string | null;
  duration_sec: number;
  sample_rate: number;
  root_note: string | null;
  family: string | null;
  waveform_peaks: number[] | null;
  source_sample_id: string | null;
  created_at: string;
}

/** Lineage entry for the recent-edits ledger. */
export interface EditLogRow {
  id: string;
  source_sample_id: string;
  created_at: string;
}

/**
 * Drafts = user's raw recordings awaiting refinement in the editor.
 * Excludes master mixdowns (those are finished looper sessions, not draft samples).
 */
export async function getUserDrafts(limit = 20): Promise<DraftRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("recordings")
    .select(
      "id, title, blob_url, duration_sec, sample_rate, waveform_peaks, recording_type, created_at"
    )
    .eq("user_id", user.id)
    .neq("recording_type", "master")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** User-owned samples saved to the library (non-system). */
export async function getUserOwnedSamples(limit = 24): Promise<UserSampleRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("samples")
    .select(
      "id, blob_url, mp3_blob_url, duration_sec, sample_rate, root_note, family, waveform_peaks, source_sample_id, created_at"
    )
    .eq("user_id", user.id)
    .eq("is_system", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** Recent lineage entries — samples that were forked from another sample. */
export async function getUserEdits(limit = 10): Promise<EditLogRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("samples")
    .select("id, source_sample_id, created_at")
    .eq("user_id", user.id)
    .not("source_sample_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).filter((row): row is EditLogRow => row.source_sample_id !== null);
}
