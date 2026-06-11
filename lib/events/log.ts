import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Interaction-event capture helpers (see docs/EVENTS.md for the vocabulary).
 *
 * All writes go through the service-role client — interaction_events has no
 * RLS insert policy by design. Consent is enforced at write time: events for
 * users without ml_consent are silently dropped, never created.
 */

/** Current envelope version. Bump on renames/semantic payload changes only. */
export const EVENT_SCHEMA_VERSION = 1;

export interface InteractionEventInput {
  eventType: string;
  payload?: Record<string, unknown>;
  sampleId?: string | null;
  queryId?: string | null;
  sessionId?: string | null;
  /** Client-side timestamp (ISO string); created_at is server truth. */
  clientTs?: string | null;
}

export interface InteractionEventContext {
  userId: string;
  deviceId?: string | null;
  source: "pi" | "web";
  schemaVersion?: number;
}

/** Returns the user's ml_consent flag (false when the row is missing). */
export async function hasMlConsent(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("ml_consent")
    .eq("id", userId)
    .single();
  return data?.ml_consent === true;
}

/**
 * Bulk-insert interaction events for a consenting user. Returns the number of
 * rows written (0 when consent is off — callers can surface that to devices
 * so they stop logging locally).
 */
export async function logInteractions(
  ctx: InteractionEventContext,
  events: InteractionEventInput[],
  opts: { skipConsentCheck?: boolean } = {},
): Promise<number> {
  if (events.length === 0) return 0;
  if (!opts.skipConsentCheck && !(await hasMlConsent(ctx.userId))) return 0;

  const supabase = createAdminClient();
  const rows = events.map((e) => ({
    schema_version: ctx.schemaVersion ?? EVENT_SCHEMA_VERSION,
    user_id: ctx.userId,
    device_id: ctx.deviceId ?? null,
    session_id: e.sessionId ?? null,
    query_id: e.queryId ?? null,
    event_type: e.eventType,
    sample_id: e.sampleId ?? null,
    source: ctx.source,
    client_ts: e.clientTs ?? null,
    payload: e.payload ?? {},
  }));

  const { error, count } = await supabase
    .from("interaction_events")
    .insert(rows, { count: "exact" });

  if (error) {
    // Capture must never break the feature it instruments.
    console.error("logInteractions failed:", error.message);
    return 0;
  }
  return count ?? rows.length;
}

/**
 * Fire-and-forget single event from web routes. Swallows all errors —
 * instrumentation must never affect the instrumented request.
 */
export async function logInteraction(
  ctx: InteractionEventContext,
  event: InteractionEventInput,
): Promise<void> {
  try {
    await logInteractions(ctx, [event]);
  } catch (err) {
    console.error("logInteraction failed:", err);
  }
}
