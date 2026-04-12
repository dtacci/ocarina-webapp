"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  upsertFavorite,
  upsertRating,
} from "@/lib/db/queries/sample-user-data";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function toggleFavorite(
  sampleId: string,
  next: boolean
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await upsertFavorite(userId, sampleId, next);
  revalidatePath("/library");
  revalidatePath(`/library/${sampleId}`);
  return { ok: true };
}

export async function setRating(
  sampleId: string,
  rating: number | null
): Promise<{ ok: true }> {
  const userId = await requireUserId();
  await upsertRating(userId, sampleId, rating);
  revalidatePath("/library");
  revalidatePath(`/library/${sampleId}`);
  return { ok: true };
}
