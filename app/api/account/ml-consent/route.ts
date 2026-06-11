import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Account-level opt-in for ML interaction logging (docs/EVENTS.md).
// The Pi learns this flag via /api/sync/heartbeat's `interactions_enabled`.

const bodySchema = z.object({ enabled: z.boolean() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({
      ml_consent: parsed.data.enabled,
      ml_consent_at: parsed.data.enabled ? new Date().toISOString() : null,
    })
    .eq("id", user.id);

  if (error) {
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
  return Response.json({ enabled: parsed.data.enabled });
}
