"use server";

import { revalidatePath } from "next/cache";
import { upsertSessionMix } from "@/lib/db/queries/session-mixes";
import type { SessionMixDoc } from "@/lib/audio/mix-types";

export async function saveSessionMix(sessionId: string, doc: SessionMixDoc) {
  const result = await upsertSessionMix(sessionId, doc);
  if ("id" in result) revalidatePath(`/tracks/${sessionId}`);
  return result;
}
