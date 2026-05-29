/**
 * Server-side ingestion of a transcription session (doc §2.2, build order step 13).
 *
 * Given a raw `.ocrec.jsonl` payload, this:
 *   1. parses + validates it,
 *   2. stores the raw file in Vercel Blob,
 *   3. inserts a `recordings` row (recording_type='transcription_session'),
 *   4. writes the parsed events to `transcription_events`,
 *   5. computes the *default* render and writes it to `transcription_renders`,
 *   6. flips `transcription_status` to 'rendered'.
 *
 * This is the seam to the real device path: Phase 2's /api/sync/confirm will call
 * `ingestSession` for uploads whose type is a transcription session, so the dev
 * ingest route and the device share identical parse/render logic.
 *
 * Writes go through the service-role admin client (bypasses RLS), exactly as the
 * existing device sync routes do.
 */

import { put } from "@vercel/blob";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseOcrec } from "./parse-jsonl";
import { derive } from "./derive";
import { DEFAULT_PARAMS } from "./types";
import { canonicalizeParams, paramsHash } from "./params-hash";
import { PARSER_VERSION } from "./index";

export interface IngestOptions {
  userId: string;
  deviceId?: string | null;
  /** Override the session title; defaults to the device/header-derived name. */
  title?: string;
}

export interface IngestResult {
  recordingId: string;
  eventCount: number;
  badLineCount: number;
  truncated: boolean;
  warningCount: number;
}

function durationSecFromEvents(events: { t_ms?: number }[]): number {
  let last = 0;
  for (const e of events) {
    if (typeof e.t_ms === "number") last = Math.max(last, e.t_ms);
  }
  return last / 1000;
}

export async function ingestSession(
  payload: string | Uint8Array,
  opts: IngestOptions,
): Promise<IngestResult> {
  const admin = createAdminClient();

  // 1. Parse + validate.
  const parsed = parseOcrec(payload);
  const { header, events, badLineCount, truncated } = parsed;
  const durationSec = durationSecFromEvents(
    events as { t_ms?: number }[],
  );
  const title = opts.title ?? "Sung transcription";

  // 2. Store the raw .ocrec.jsonl in Blob. A string body is the simplest valid
  // PutBody; gzipped (Uint8Array) device payloads become a Node Buffer.
  const body: string | Buffer =
    typeof payload === "string" ? payload : Buffer.from(payload);
  const blob = await put(
    `${opts.userId}/transcriptions/${header.session_uuid}.ocrec.jsonl`,
    body,
    { access: "public", contentType: "application/x-ocrec+jsonl", addRandomSuffix: true },
  );

  // 3. Insert the parent recordings row.
  const { data: recording, error: recError } = await admin
    .from("recordings")
    .insert({
      user_id: opts.userId,
      device_id: opts.deviceId ?? null,
      title,
      blob_url: blob.url,
      duration_sec: durationSec,
      sample_rate: 44100,
      recording_type: "transcription_session",
      transcription_status: "parsing",
      firmware_version: header.firmware_version ?? null,
      parser_version: PARSER_VERSION,
      event_count: events.length,
      is_public: false,
    })
    .select()
    .single();

  if (recError || !recording) {
    throw new Error(`Failed to insert recording: ${recError?.message}`);
  }
  const sessionId = recording.id as string;

  // 4. Persist the parsed events (one blob row per session).
  const { error: evError } = await admin.from("transcription_events").insert({
    session_id: sessionId,
    events_jsonb: events,
    header_jsonb: header,
    parser_version: PARSER_VERSION,
  });
  if (evError) throw new Error(`Failed to insert events: ${evError.message}`);

  // 5. Compute and cache the default render.
  const params = {
    ...DEFAULT_PARAMS,
    // The fake/device header doesn't carry tempo; defaults stand and we flag it.
  };
  const result = derive(events, header, params, {
    title,
    tempoGuessed: true,
  });
  const hash = await paramsHash(params);

  const { error: renderError } = await admin.from("transcription_renders").insert({
    session_id: sessionId,
    params_hash: hash,
    params_jsonb: JSON.parse(canonicalizeParams(params)),
    parser_version: PARSER_VERSION,
    notation_jsonb: { notes: result.notes, chapters: result.chapters, warnings: result.warnings },
    musicxml: result.musicxml,
    is_default: true,
  });
  if (renderError) {
    throw new Error(`Failed to insert default render: ${renderError.message}`);
  }

  // 6. Mark the session ready.
  await admin
    .from("recordings")
    .update({
      transcription_status: truncated ? "partial" : "rendered",
    })
    .eq("id", sessionId);

  return {
    recordingId: sessionId,
    eventCount: events.length,
    badLineCount,
    truncated,
    warningCount: result.warnings.length,
  };
}
