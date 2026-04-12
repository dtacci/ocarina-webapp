import { createClient } from "@/lib/supabase/server";

export interface KaraokeUserState {
  isFavorite: boolean;
}

export async function getUserKaraokeData(
  userId: string,
  songIds: string[]
): Promise<Map<string, KaraokeUserState>> {
  const map = new Map<string, KaraokeUserState>();
  if (songIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("karaoke_user_data")
    .select("song_id, is_favorite")
    .eq("user_id", userId)
    .in("song_id", songIds);

  if (data) {
    for (const row of data) {
      map.set(row.song_id, { isFavorite: !!row.is_favorite });
    }
  }
  return map;
}

export async function getUserKaraokeState(
  userId: string,
  songId: string
): Promise<KaraokeUserState> {
  const map = await getUserKaraokeData(userId, [songId]);
  return map.get(songId) ?? { isFavorite: false };
}

export async function upsertKaraokeFavorite(
  userId: string,
  songId: string,
  isFavorite: boolean
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("karaoke_user_data")
    .upsert(
      {
        user_id: userId,
        song_id: songId,
        is_favorite: isFavorite,
      },
      { onConflict: "user_id,song_id" }
    );
  if (error) throw error;
}
