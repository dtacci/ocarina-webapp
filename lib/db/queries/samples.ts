import { createClient } from "@/lib/supabase/server";

export interface SampleFilters {
  family?: string;
  category?: string;
  vibes?: string[];
  brightnessMin?: number;
  brightnessMax?: number;
  warmthMin?: number;
  warmthMax?: number;
  attackMin?: number;
  attackMax?: number;
  sustainMin?: number;
  sustainMax?: number;
  search?: string;
  page?: number;
  perPage?: number;
  /** Restrict to samples favorited by this user id (ignored if undefined) */
  favoritedBy?: string;
  /** Restrict to samples rated >= this value by `ratedBy` */
  minRating?: number;
  /** User whose ratings are used for `minRating` (required with minRating) */
  ratedBy?: string;
}

export interface SampleRow {
  id: string;
  blob_url: string;
  mp3_blob_url: string | null;  // Vercel Blob URL for 6s preview — null until batch script runs
  duration_sec: number;
  sample_rate: number;
  root_note: string | null;
  root_freq: number | null;
  brightness: number | null;
  attack: number | null;
  sustain: number | null;
  texture: number | null;
  warmth: number | null;
  category: string | null;
  family: string | null;
  loopable: boolean;
  is_system: boolean;
  waveform_peaks: number[] | null;
  /** Set on samples forked by the sample editor — points to the original. */
  source_sample_id?: string | null;
  /** JSONB — the EffectNode[] chain that was applied when this sample was baked. */
  edit_spec?: unknown;
  user_id?: string | null;
}

export interface SampleWithVibes extends SampleRow {
  vibes: string[];
}

const PAGE_SIZE = 48;

export async function getSamples(filters: SampleFilters): Promise<{
  samples: SampleWithVibes[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const supabase = await createClient();
  const page = filters.page || 1;
  const perPage = filters.perPage || PAGE_SIZE;
  const offset = (page - 1) * perPage;

  // If filtering by vibes, first get matching sample IDs
  let vibeFilterIds: string[] | null = null;
  if (filters.vibes && filters.vibes.length > 0) {
    const { data: vibeMatches } = await supabase
      .from("sample_vibes")
      .select("sample_id")
      .in("vibe", filters.vibes);

    if (vibeMatches) {
      // Count how many of the requested vibes each sample matches
      const counts: Record<string, number> = {};
      for (const row of vibeMatches) {
        counts[row.sample_id] = (counts[row.sample_id] || 0) + 1;
      }
      // Require ALL requested vibes to match
      vibeFilterIds = Object.entries(counts)
        .filter(([, c]) => c >= filters.vibes!.length)
        .map(([id]) => id);

      if (vibeFilterIds.length === 0) {
        return { samples: [], total: 0, page, totalPages: 0 };
      }
    }
  }

  // If filtering by favorite or user-rating, resolve to a sample-id set
  let userDataIds: string[] | null = null;
  const wantsFavorite = Boolean(filters.favoritedBy);
  const wantsRating =
    filters.ratedBy !== undefined &&
    filters.minRating !== undefined &&
    filters.minRating > 0;
  if (wantsFavorite || wantsRating) {
    const userId = filters.favoritedBy ?? filters.ratedBy;
    let udQuery = supabase
      .from("sample_user_data")
      .select("sample_id, is_favorite, user_rating")
      .eq("user_id", userId!);
    if (wantsFavorite) udQuery = udQuery.eq("is_favorite", true);
    if (wantsRating) udQuery = udQuery.gte("user_rating", filters.minRating!);
    const { data: udRows } = await udQuery;
    userDataIds = (udRows ?? []).map((r) => r.sample_id);
    if (userDataIds.length === 0) {
      return { samples: [], total: 0, page, totalPages: 0 };
    }
  }

  // Intersect vibe and user-data ID sets when both are present
  let combinedIds: string[] | null = null;
  if (vibeFilterIds && userDataIds) {
    const udSet = new Set(userDataIds);
    combinedIds = vibeFilterIds.filter((id) => udSet.has(id));
    if (combinedIds.length === 0) {
      return { samples: [], total: 0, page, totalPages: 0 };
    }
  } else {
    combinedIds = vibeFilterIds ?? userDataIds;
  }

  // Build the main query
  let query = supabase
    .from("samples")
    .select("*", { count: "exact" })
    .eq("is_system", true);

  if (filters.family) query = query.eq("family", filters.family);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.brightnessMin) query = query.gte("brightness", filters.brightnessMin);
  if (filters.brightnessMax) query = query.lte("brightness", filters.brightnessMax);
  if (filters.warmthMin) query = query.gte("warmth", filters.warmthMin);
  if (filters.warmthMax) query = query.lte("warmth", filters.warmthMax);
  if (filters.attackMin) query = query.gte("attack", filters.attackMin);
  if (filters.attackMax) query = query.lte("attack", filters.attackMax);
  if (filters.sustainMin) query = query.gte("sustain", filters.sustainMin);
  if (filters.sustainMax) query = query.lte("sustain", filters.sustainMax);
  if (filters.search) query = query.ilike("id", `%${filters.search}%`);
  if (combinedIds) query = query.in("id", combinedIds);

  query = query
    .order("family", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + perPage - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const sampleRows = (data || []) as SampleRow[];
  const total = count || 0;

  // Fetch vibes for the returned samples
  const sampleIds = sampleRows.map((s) => s.id);
  const vibesMap: Record<string, string[]> = {};

  if (sampleIds.length > 0) {
    const { data: vibesData } = await supabase
      .from("sample_vibes")
      .select("sample_id, vibe")
      .in("sample_id", sampleIds);

    if (vibesData) {
      for (const row of vibesData) {
        if (!vibesMap[row.sample_id]) vibesMap[row.sample_id] = [];
        vibesMap[row.sample_id].push(row.vibe);
      }
    }
  }

  const samples: SampleWithVibes[] = sampleRows.map((s) => ({
    ...s,
    vibes: vibesMap[s.id] || [],
  }));

  return {
    samples,
    total,
    page,
    totalPages: Math.ceil(total / perPage),
  };
}

export async function getSample(id: string): Promise<SampleWithVibes | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("samples")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const { data: vibesData } = await supabase
    .from("sample_vibes")
    .select("vibe")
    .eq("sample_id", id);

  return {
    ...data as SampleRow,
    vibes: vibesData?.map((v) => v.vibe) ?? [],
  };
}

export async function getFamilyCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("samples")
    .select("family")
    .eq("is_system", true);

  const counts: Record<string, number> = {};
  if (data) {
    for (const row of data) {
      if (row.family) counts[row.family] = (counts[row.family] || 0) + 1;
    }
  }
  return counts;
}

export async function getPopularVibes(limit = 30): Promise<{ vibe: string; count: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_popular_vibes", { lim: limit });
  // Fallback if RPC doesn't exist yet
  if (!data) {
    const { data: vibesData } = await supabase
      .from("sample_vibes")
      .select("vibe");
    const counts: Record<string, number> = {};
    if (vibesData) {
      for (const row of vibesData) {
        counts[row.vibe] = (counts[row.vibe] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([vibe, count]) => ({ vibe, count }));
  }
  return data;
}
