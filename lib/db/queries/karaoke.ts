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
}

export interface KaraokeFilters {
  decade?: string;
  genre?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export async function getKaraokeSongs(
  filters: KaraokeFilters = {}
): Promise<{ songs: KaraokeSongRow[]; total: number }> {
  const supabase = await createClient();
  const { decade, genre, search, page = 1, perPage = 24 } = filters;

  let query = supabase
    .from("karaoke_songs")
    .select("*", { count: "exact" });

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
    .order("artist", { ascending: true })
    .order("title", { ascending: true })
    .range(from, from + perPage - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return { songs: data ?? [], total: count ?? 0 };
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
