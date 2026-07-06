"use server";

import { revalidatePath } from "next/cache";
import { getSample, type SampleWithVibes } from "@/lib/db/queries/samples";
import { getRecordingForEditor } from "@/lib/db/queries/sample-editor";

/**
 * Invalidate the sample-editor landing + library listings after a save.
 * Called by the client after a successful POST to /api/samples/create.
 */
export async function revalidateSampleEditor(): Promise<void> {
  revalidatePath("/sample-editor");
  revalidatePath("/library");
}

/**
 * Server action used by the workshop floor's tile-click handler to load a
 * sample inline into the editor surface. Falls back to the recording-table
 * lookup so a freshly-recorded draft (which lives in `recordings`) can be
 * loaded the same way as a saved sample.
 */
export async function loadSampleForEditor(
  id: string,
): Promise<SampleWithVibes | null> {
  const sample = await getSample(id);
  if (sample) return sample;
  return await getRecordingForEditor(id);
}
