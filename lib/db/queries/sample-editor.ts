import { createClient } from "@/lib/supabase/server";
import type { SampleWithVibes } from "@/lib/db/queries/samples";

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
  title: string | null;
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
      "id, title, blob_url, mp3_blob_url, duration_sec, sample_rate, root_note, family, waveform_peaks, source_sample_id, created_at"
    )
    .eq("user_id", user.id)
    .eq("is_system", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch a recording row and adapt it to the SampleWithVibes shape so the
 * Editor can load it identically to a saved sample. Recordings lack most
 * sample metadata (root_note, family, brightness sliders, vibes) — those
 * default to null so the metadata panel surfaces them as "untagged".
 *
 * RLS on `recordings` already restricts to user_id = auth.uid(), so the
 * caller doesn't need an explicit auth check.
 */
export async function getRecordingForEditor(
  id: string,
): Promise<SampleWithVibes | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recordings")
    .select(
      "id, user_id, title, bpm, blob_url, duration_sec, sample_rate, waveform_peaks",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    // Recording titles ("Stem A", "Drum loop — …") pre-fill the save name;
    // bpm rides through so the baked sample keeps its tempo tag.
    title: data.title ?? null,
    blob_url: data.blob_url,
    mp3_blob_url: null,
    duration_sec: data.duration_sec,
    sample_rate: data.sample_rate,
    root_note: null,
    root_freq: null,
    brightness: null,
    attack: null,
    sustain: null,
    texture: null,
    warmth: null,
    category: null,
    family: null,
    bpm: data.bpm ?? null,
    loopable: false,
    is_system: false,
    waveform_peaks: data.waveform_peaks,
    source_sample_id: null,
    edit_spec: null,
    user_id: data.user_id,
    vibes: [],
  };
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
