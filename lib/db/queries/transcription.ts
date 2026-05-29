/**
 * Queries for transcription sessions, events, and cached renders.
 *
 * Scoping mirrors lib/db/queries/recordings.ts: the authenticated owner path
 * uses createClient() (RLS owner policy applies); the public-share path uses
 * createAdminClient() (service role bypasses RLS), exactly as listPublicRecordings
 * does. Server-side ingest writes (see lib/transcription/ingest.ts) use the admin
 * client directly and don't go through here.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RecordingRow } from "./recordings";
import type {
  DeriveParams,
  OcarinaEvent,
  OcarinaHeader,
} from "@/lib/transcription/types";

export interface TranscriptionEventsRow {
  session_id: string;
  events_jsonb: OcarinaEvent[];
  header_jsonb: OcarinaHeader;
  parser_version: number;
  parsed_at: string;
}

export interface TranscriptionRenderRow {
  id: string;
  session_id: string;
  params_hash: string;
  params_jsonb: DeriveParams;
  parser_version: number;
  notation_jsonb: unknown | null;
  musicxml: string | null;
  midi_blob_url: string | null;
  pdf_blob_url: string | null;
  is_default: boolean;
  generated_at: string;
}

/** Owner-scoped read of the raw events for in-browser re-derivation. */
export async function getTranscriptionEvents(
  sessionId: string,
): Promise<TranscriptionEventsRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transcription_events")
    .select("*")
    .eq("session_id", sessionId)
    .single();
  if (error) return null;
  return data as TranscriptionEventsRow;
}

/** The pinned default render for a session (owner path). */
export async function getDefaultRender(
  sessionId: string,
): Promise<TranscriptionRenderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transcription_renders")
    .select("*")
    .eq("session_id", sessionId)
    .eq("is_default", true)
    .single();
  if (error) return null;
  return data as TranscriptionRenderRow;
}

/** Default render via the admin client — used by the public share page. */
export async function getPublicDefaultRender(
  sessionId: string,
): Promise<TranscriptionRenderRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("transcription_renders")
    .select("*")
    .eq("session_id", sessionId)
    .eq("is_default", true)
    .single();
  return (data as TranscriptionRenderRow) ?? null;
}

/** Cache lookup for a specific parameter combination. */
export async function getRenderByHash(
  sessionId: string,
  paramsHash: string,
  parserVersion: number,
): Promise<TranscriptionRenderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transcription_renders")
    .select("*")
    .eq("session_id", sessionId)
    .eq("params_hash", paramsHash)
    .eq("parser_version", parserVersion)
    .maybeSingle();
  if (error) return null;
  return (data as TranscriptionRenderRow) ?? null;
}

/** Write-back of a client-computed render into the cache (owner path). */
export async function upsertRender(row: {
  session_id: string;
  params_hash: string;
  params_jsonb: DeriveParams;
  parser_version: number;
  notation_jsonb?: unknown;
  musicxml?: string;
}): Promise<TranscriptionRenderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transcription_renders")
    .upsert(row, { onConflict: "session_id,params_hash,parser_version" })
    .select()
    .single();
  if (error) return null;
  return data as TranscriptionRenderRow;
}

/** The user's transcription sessions for the browse view (PR7). */
export async function listTranscriptionSessions(opts: {
  limit?: number;
  offset?: number;
} = {}): Promise<RecordingRow[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
  const offset = Math.max(0, opts.offset ?? 0);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", user.id)
    .eq("recording_type", "transcription_session")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return [];
  return (data ?? []) as RecordingRow[];
}
