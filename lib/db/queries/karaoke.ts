import { createClient } from "@/lib/supabase/server";

export interface KaraokeSongRow {
  id: string;
  title: string;
  artist: string;
  decade: string;
  genre: string[];
  tags: string[];
  duration_sec: number | null;
  key: string | null;
  source: string;
  available: boolean;
  midi_blob_url: string | null;
  wav_blob_url: string | null;
}

export interface KaraokeFilters {
  decade?: string;
  genre?: string;
  search?: string;
  page?: number;
  perPage?: number;
  /** Restrict to songs favorited by this user id */
  favoritedBy?: string;
}

export async function getKaraokeSongs(
  filters: KaraokeFilters = {}
): Promise<{ songs: KaraokeSongRow[]; total: number }> {
  const supabase = await createClient();
  const { decade, genre, search, favoritedBy, page = 1, perPage = 24 } = filters;

  // Resolve favorited song ids first; empty set short-circuits to empty result.
  let favoriteIds: string[] | null = null;
  if (favoritedBy) {
    const { data: favRows } = await supabase
      .from("karaoke_user_data")
      .select("song_id")
      .eq("user_id", favoritedBy)
      .eq("is_favorite", true);
    favoriteIds = (favRows ?? []).map((r) => r.song_id);
    if (favoriteIds.length === 0) {
      return { songs: [], total: 0 };
    }
  }

  let query = supabase
    .from("karaoke_songs")
    .select("*", { count: "exact" });

  if (favoriteIds) {
    query = query.in("id", favoriteIds);
  }

  if (decade) {
    query = query.eq("decade", decade);
  }

  if (genre) {
    query = query.contains("genre", [genre]);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%`);
  }

  const from = (page - 1) * perPage;
  query = query
    // Playable songs (midi_blob_url or wav_blob_url set) surface first.
    // Postgres NULLS LAST ordering — songs without any blob URL fall to the bottom.
    .order("midi_blob_url", { ascending: false, nullsFirst: false })
    .order("wav_blob_url", { ascending: false, nullsFirst: false })
    .order("artist", { ascending: true })
    .order("title", { ascending: true })
    .range(from, from + perPage - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return { songs: data ?? [], total: count ?? 0 };
}

export async function getKaraokeSong(id: string): Promise<KaraokeSongRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("karaoke_songs")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as KaraokeSongRow;
}

export async function getKaraokeDecades(): Promise<{ decade: string; count: number }[]> {
  const supabase = await createClient();

  // Get distinct decades with counts
  const { data, error } = await supabase
    .from("karaoke_songs")
    .select("decade");

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.decade, (counts.get(row.decade) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade));
}
