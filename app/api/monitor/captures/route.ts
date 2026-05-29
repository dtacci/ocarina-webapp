import { z } from "zod";
import { put } from "@vercel/blob";

import { createClient } from "@/lib/supabase/server";
import { listMyCaptures } from "@/lib/db/queries/monitor-captures";

export const maxDuration = 60;

const MAX_EVENTS = 50_000;

const logEntrySchema = z.object({
  id: z.string(),
  kind: z.enum([
    "note",
    "fx",
    "button",
    "heartbeat",
    "kit",
    "karaoke",
    "madlibs",
    "loop",
    "misc",
  ]),
  text: z.string(),
  ts: z.number(),
});

// Structured loop snapshots persisted alongside the LogEntries — lets a
// future replay drive the LoopStatePanel rather than just the event log.
const loopSnapshotSchema = z.object({
  ts: z.number(),
  snapshot: z.object({
    bpm: z.number().nullable(),
    master_length_ms: z.number(),
    active_track: z.number(),
    tracks: z.array(z.object({
      id: z.number(),
      state: z.enum(["empty", "recording", "playing", "muted"]),
      length_ms: z.number(),
      muted: z.boolean(),
    })),
  }),
});

const postSchema = z.object({
  name: z.string().min(1).max(120),
  source: z.enum(["pi_rest", "realtime", "webserial"]),
  deviceId: z.string().uuid().nullable().optional(),
  deviceName: z.string().nullable().optional(),
  startedAt: z.number(),
  endedAt: z.number(),
  events: z.array(logEntrySchema).max(MAX_EVENTS),
  loopSnapshots: z.array(loopSnapshotSchema).max(MAX_EVENTS).optional(),
});

export async function GET() {
  const captures = await listMyCaptures();
  return Response.json({ captures });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, source, deviceId, deviceName, startedAt, endedAt, events, loopSnapshots } =
    parsed.data;

  // Denormalize counts for the list view — saves fetching the blob to render
  // the card.
  let buttons = 0,
    notes = 0,
    fx = 0,
    heartbeats = 0,
    loops = 0,
    gpio = 0,
    misc = 0;
  for (const e of events) {
    switch (e.kind) {
      case "button":    buttons++;    break;
      case "note":      notes++;      break;
      case "fx":        fx++;         break;
      case "heartbeat": heartbeats++; break;
      case "loop":      loops++;      break;
      // GPIO events are logged via the same "button" kind today; if the
      // sink ever distinguishes them, count goes here. Tracked separately
      // so we can pull it apart later without a migration.
      case "misc":      misc++;       break;
    }
  }
  // Heuristic: "pin <N>" entries inside the button bucket map to Teensy/
  // GPIO; for now we keep them in the buttons count. gpio left at 0 until
  // we differentiate at the sink level.
  void gpio;

  // Upload payload JSON to Vercel Blob first — if this fails we don't insert
  // an orphan row.
  const blobPath = `${user.id}/monitor-captures/${Date.now()}-${slug(name)}.json`;
  const payload = {
    name,
    source,
    deviceId: deviceId ?? null,
    deviceName: deviceName ?? null,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    eventCount: events.length,
    events,
    loopSnapshots: loopSnapshots ?? [],
  };

  let blob;
  try {
    blob = await put(blobPath, JSON.stringify(payload), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: true,
    });
  } catch (err) {
    return Response.json(
      { error: "Blob upload failed", detail: String(err) },
      { status: 500 }
    );
  }

  const { data: row, error: insertErr } = await supabase
    .from("monitor_captures")
    .insert({
      user_id: user.id,
      device_id: deviceId ?? null,
      name,
      blob_url: blob.url,
      blob_pathname: blob.pathname,
      source,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      duration_ms: Math.max(0, endedAt - startedAt),
      event_count: events.length,
      button_event_count: buttons,
      note_event_count: notes,
      fx_event_count: fx,
      heartbeat_count: heartbeats,
      loop_event_count: loops,
      misc_event_count: misc,
    })
    .select()
    .single();

  if (insertErr || !row) {
    // Try to clean up the orphan blob so we don't accrue garbage.
    try {
      const { del } = await import("@vercel/blob");
      await del(blob.url);
    } catch {
      // Best-effort cleanup; log via console for triage.
      console.warn("orphan blob left after failed insert:", blob.url);
    }
    return Response.json(
      { error: "Insert failed", detail: insertErr?.message ?? "no row returned" },
      { status: 500 }
    );
  }

  return Response.json({ capture: row });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "capture";
}
