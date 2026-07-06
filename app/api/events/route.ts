import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { logInteractions } from "@/lib/events/log";

// Browser-originated interaction events (search result clicks, ratings,
// description edits). Session-authenticated. See docs/EVENTS.md.

const eventSchema = z.object({
  event_type: z.string().min(1).max(64),
  sample_id: z.string().max(256).nullish(),
  query_id: z.string().uuid().nullish(),
  session_id: z.string().uuid().nullish(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
});

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

  const accepted = await logInteractions(
    { userId: user.id, source: "web" },
    parsed.data.events.map((e) => ({
      eventType: e.event_type,
      payload: e.payload,
      sampleId: e.sample_id,
      queryId: e.query_id,
      sessionId: e.session_id,
    })),
  );

  return Response.json({ accepted });
}
