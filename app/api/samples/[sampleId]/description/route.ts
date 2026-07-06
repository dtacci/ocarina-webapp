import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { reviseDescription } from "@/lib/db/queries/sample-descriptions";
import { logInteraction } from "@/lib/events/log";

// Human edit of a sample description. The LLM-proposed → human-edited chain
// (parent_description_id) is captured for future fine-tuning (docs/EVENTS.md).

const bodySchema = z.object({ text: z.string().min(10).max(2000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sampleId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sampleId } = await params;
  const decodedId = decodeURIComponent(sampleId);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const { id, parentId } = await reviseDescription(
      decodedId,
      parsed.data.text.trim(),
      user.id,
    );

    void logInteraction(
      { userId: user.id, source: "web" },
      {
        eventType: "description_edited",
        sampleId: decodedId,
        payload: { description_id: id, parent_description_id: parentId },
      },
    );

    return Response.json({ id });
  } catch (err) {
    console.error("description revise failed:", err);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}
