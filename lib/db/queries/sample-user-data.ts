import { createClient } from "@/lib/supabase/server";

export interface SampleUserState {
  isFavorite: boolean;
  userRating: number | null;
}

export async function getUserSampleData(
  userId: string,
  sampleIds: string[]
): Promise<Map<string, SampleUserState>> {
  const map = new Map<string, SampleUserState>();
  if (sampleIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("sample_user_data")
    .select("sample_id, is_favorite, user_rating")
    .eq("user_id", userId)
    .in("sample_id", sampleIds);

  if (data) {
    for (const row of data) {
      map.set(row.sample_id, {
        isFavorite: !!row.is_favorite,
        userRating: row.user_rating ?? null,
      });
    }
  }
  return map;
}

export async function getUserSampleState(
  userId: string,
  sampleId: string
): Promise<SampleUserState> {
  const map = await getUserSampleData(userId, [sampleId]);
  return map.get(sampleId) ?? { isFavorite: false, userRating: null };
}

export async function upsertFavorite(
  userId: string,
  sampleId: string,
  isFavorite: boolean
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sample_user_data")
    .upsert(
      {
        user_id: userId,
        sample_id: sampleId,
        is_favorite: isFavorite,
      },
      { onConflict: "user_id,sample_id" }
    );
  if (error) throw error;
}

export async function upsertRating(
  userId: string,
  sampleId: string,
  rating: number | null
): Promise<void> {
  if (rating !== null && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    throw new Error("rating must be integer 1-5 or null");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("sample_user_data")
    .upsert(
      {
        user_id: userId,
        sample_id: sampleId,
        user_rating: rating,
      },
      { onConflict: "user_id,sample_id" }
    );
  if (error) throw error;
}
