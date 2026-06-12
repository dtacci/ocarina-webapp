import { createClient } from "@/lib/supabase/server";

/**
 * Track sources for the DJ deck browser. Everything returned here is
 * guaranteed web-fetchable (absolute blob URL) — device-hosted system
 * samples are excluded for the same reason the sample editor hides them.
 */
export interface DjSource {
  id: string;
  kind: "recording" | "sample";
  title: string;
  durationSec: number;
  bpm: number | null;
  url: string;
  /** 'upload' | 'stem' | 'master' for recordings; null for samples. */
  recordingType: string | null;
}

export async function getDjSources(): Promise<DjSource[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [recordings, samples] = await Promise.all([
    supabase
      .from("recordings")
      .select("id,title,blob_url,duration_sec,bpm,recording_type")
      .eq("user_id", user.id)
      .neq("recording_type", "transcription_session")
      .not("blob_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("samples")
      .select("id,title,blob_url,duration_sec,bpm")
      .eq("user_id", user.id)
      .like("blob_url", "http%")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const out: DjSource[] = [];
  for (const r of recordings.data ?? []) {
    if (!r.blob_url?.startsWith("http")) continue;
    out.push({
      id: r.id,
      kind: "recording",
      title: r.title ?? "Untitled recording",
      durationSec: r.duration_sec ?? 0,
      bpm: r.bpm,
      url: r.blob_url,
      recordingType: r.recording_type,
    });
  }
  for (const s of samples.data ?? []) {
    out.push({
      id: s.id,
      kind: "sample",
      title: s.title ?? "Untitled sample",
      durationSec: s.duration_sec ?? 0,
      bpm: s.bpm ?? null,
      url: s.blob_url,
      recordingType: null,
    });
  }
  return out;
}
