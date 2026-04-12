"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { upsertKaraokeFavorite } from "@/lib/db/queries/karaoke-user-data";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function toggleKaraokeFavorite(
  songId: string,
  next: boolean
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await upsertKaraokeFavorite(userId, songId, next);
  revalidatePath("/karaoke");
  revalidatePath(`/karaoke/${songId}`);
  return { ok: true };
}
