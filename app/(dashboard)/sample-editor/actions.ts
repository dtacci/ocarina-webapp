"use server";

import { revalidatePath } from "next/cache";

/**
 * Invalidate the sample-editor landing + library listings after a save.
 * Called by the client after a successful POST to /api/samples/create.
 */
export async function revalidateSampleEditor(): Promise<void> {
  revalidatePath("/sample-editor");
  revalidatePath("/library");
}
