import { z } from "zod";

import { authenticateDevice } from "@/lib/api/auth-device";
import { hasMlConsent, logInteractions } from "@/lib/events/log";

// Batch interaction-event ingest from devices (Pi). See docs/EVENTS.md.
// The Pi queues events in SQLite offline and flushes batches here.

const eventSchema = z.object({
  event_type: z.string().min(1).max(64),
  ts: z.string().optional(), // client-side ISO timestamp
  session_id: z.string().uuid().nullish(),
  sample_id: z.string().max(256).nullish(),
  query_id: z.string().uuid().nullish(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const bodySchema = z.object({
  v: z.number().int().min(1).default(1),
  events: z.array(eventSchema).min(1).max(200),
});

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", details: parsed.error.issues.slice(0, 3) },
      { status: 400 },
    );
  }

  // Consent gate: tell the device explicitly so it stops logging locally.
  if (!(await hasMlConsent(device.userId))) {
    return Response.json({ accepted: 0, consent: false });
  }

  const accepted = await logInteractions(
    {
      userId: device.userId,
      deviceId: device.id,
      source: "pi",
      schemaVersion: parsed.data.v,
    },
    parsed.data.events.map((e) => ({
      eventType: e.event_type,
      payload: e.payload,
      sampleId: e.sample_id,
      queryId: e.query_id,
      sessionId: e.session_id,
      clientTs: e.ts,
    })),
    { skipConsentCheck: true },
  );

  return Response.json({ accepted, consent: true });
}
