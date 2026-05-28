/**
 * TypeScript client for the Pi's FastAPI server. The Pi exposes REST endpoints
 * for button remapping + a WebSocket stream for live telemetry, fronted by
 * Tailscale Funnel for HTTPS access from the Vercel-deployed page.
 *
 * Endpoint surface and shapes are authoritative in
 * digital-ocarina/pi/api/NEXTJS_INTEGRATION.md.
 */

// Trim trailing whitespace + literal "\n" sequences that can sneak in when
// the Vercel env value was pasted with a trailing newline (we hit this once
// during setup — the symptom is "Bad hostname" on fetch).
const RAW_BASE = (process.env.NEXT_PUBLIC_OCARINA_API ?? "").trim();
const RAW_TOKEN = (process.env.NEXT_PUBLIC_OCARINA_TOKEN ?? "").trim();

const BASE = RAW_BASE.replace(/(?:\\n|\s)+$/g, "").replace(/\/+$/, "");
const TOKEN = RAW_TOKEN.replace(/(?:\\n|\s)+$/g, "");

export function isOcarinaApiConfigured(): boolean {
  return BASE.length > 0;
}

export function getOcarinaApiBase(): string {
  return BASE;
}

const authHeaders = (): HeadersInit =>
  TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

const jsonHeaders = (): HeadersInit => ({
  "content-type": "application/json",
  ...authHeaders(),
});

async function jsonOrThrow<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText}${body ? `: ${body}` : ""}`);
  }
  return (await r.json()) as T;
}

// ---------- Types ----------

export interface ButtonState {
  button: number; // 1..12
  note_index: number; // 0..11
  note_name: string | null;
  default_name: string;
  overridden: boolean;
}

export interface StatusResponse {
  buttons: ButtonState[];
}

/**
 * Write endpoints return narrow action-confirmations, not the full status.
 * Callers wanting current state must refetch via `ocarina.status()`. These
 * shapes are verified empirically against the running server (the integration
 * doc claimed StatusResponse for all of them — it was wrong).
 */
export interface SetButtonResponse {
  button: number;
  note_index: number; // -1 when reset to default
  note_name: string; // "default" sentinel when reset
}
export interface ClearAllResponse { cleared: true }
export interface ReapplyResponse { reapplied: true; buttons: { button: number; note_name: string }[] }
export interface ApplyPresetResponse { applied: string; notes: string[] }
export interface SaveUserPresetResponse { saved: string; notes: string[] }
export interface DeleteUserPresetResponse { deleted: string }

export interface SimKeyResponse {
  sent: string;
  bytes_written: number;
}

export interface VersionInfo {
  api_version: string;
  git_sha: string;
  git_branch: string;
  git_dirty: boolean;
  firmware: { name: string; build_date: string };
  started_at: number;
  uptime_s: number;
}

/**
 * Structured shape for the Pi's 4xx/5xx responses, per the integration doc.
 * 503 is the retry-able shape — hint is operator-facing and safe to show
 * verbatim. 400's detail is also user-safe. Other statuses (422 / 502) are
 * intentionally not parsed into a user message — the caller picks a
 * UX-appropriate fallback.
 */
export interface OcarinaApiError {
  status: number;
  detail?: string;
  hint?: string;
  retryAfter?: number;
}

export async function parseOcarinaError(r: Response): Promise<OcarinaApiError> {
  try {
    const body = (await r.json()) as Record<string, unknown>;
    return {
      status: r.status,
      detail: typeof body.detail === "string" ? body.detail : undefined,
      hint: typeof body.hint === "string" ? body.hint : undefined,
      retryAfter:
        typeof body.retry_after === "number" ? body.retry_after : undefined,
    };
  } catch {
    return { status: r.status };
  }
}

/** True for 503 — caller should retry after `retryAfter` seconds. */
export function isRetryableOcarinaError(e: OcarinaApiError): boolean {
  return e.status === 503;
}

export interface PresetEntry {
  name: string;
  notes: string[]; // length 12, one per button
}

export type PresetIndex = Record<string, PresetEntry>;

export type TeensyHealth =
  | { connected: true; latency_ms: number }
  | { connected: false; latency_ms?: number; error: string };

export interface HeartbeatEvent {
  type: "heartbeat";
  uptime_s: number;
  pots: {
    volume: number;
    reverb_mix: number;
    filter: number;
    pitch_bend: number;
  };
  mic: {
    enabled: boolean;
    freq_hz: number;
    probability: number;
    amplitude: number;
    valid: boolean;
  };
}

export interface NoteOnEvent {
  type: "note_on";
  note: string;
  freq_hz: number;
}

export interface NoteOffEvent {
  type: "note_off";
  button: number;
}

/**
 * Stable webapp-facing names for the 5 Pi GPIO buttons. The wire format uses
 * `name` (not `pin`) as the canonical identifier so future board revs can
 * move pins without breaking the protocol.
 */
export type PiGpioName = "inst_1" | "inst_2" | "inst_3" | "inst_4" | "voice";

export interface GpioPressEvent {
  type: "gpio_press";
  name: string; // PiGpioName today; left as `string` so unknown names don't crash older clients
  pin: number;  // BCM pin
  ts_ms?: number;
}

export interface GpioReleaseEvent {
  type: "gpio_release";
  name: string;
  pin: number;
  ts_ms?: number;
}

export type EventMessage =
  | HeartbeatEvent
  | NoteOnEvent
  | NoteOffEvent
  | GpioPressEvent
  | GpioReleaseEvent;

// ---------- REST ----------

export const ocarina = {
  health: () =>
    fetch(`${BASE}/health`).then((r) => jsonOrThrow<{ status: string }>(r)),

  /** No-auth boot info — git SHA, branch, firmware build, uptime. */
  version: () =>
    fetch(`${BASE}/version`).then((r) => jsonOrThrow<VersionInfo>(r)),

  teensyHealth: () =>
    fetch(`${BASE}/healthz/teensy`, { headers: authHeaders() }).then((r) =>
      jsonOrThrow<TeensyHealth>(r)
    ),

  /**
   * Feed raw char(s) to the firmware's keyboard simulator.
   *   Notes:        w=C e=C# r=D t=D# y=E u=F I=F#(uppercase!) o=G p=G# [=A ]=A# \=B
   *   Action keys:  ' '=all-off, '1'-'4'=track, 'a'=mute, 'b'=tap-tempo, 'l'=record
   * Lowercase 'i' is a Wire2 I2C scan — DO NOT send when meaning F#.
   */
  simKey: (key: string) =>
    fetch(`${BASE}/sim_key`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ key }),
    }).then((r) => jsonOrThrow<SimKeyResponse>(r)),

  status: () =>
    fetch(`${BASE}/status`, { headers: authHeaders() }).then((r) =>
      jsonOrThrow<StatusResponse>(r)
    ),

  setButton: (button: number, note: string | number) =>
    fetch(`${BASE}/map`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ button, note }),
    }).then((r) => jsonOrThrow<SetButtonResponse>(r)),

  clearAll: () =>
    fetch(`${BASE}/map/clear`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => jsonOrThrow<ClearAllResponse>(r)),

  reapplyPersisted: () =>
    fetch(`${BASE}/map/reapply`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => jsonOrThrow<ReapplyResponse>(r)),

  // Built-in + user presets are both returned as a keyed object, NOT the
  // `{ presets: [...] }` array shape the integration doc described — verified
  // empirically against the running server.
  listPresets: () =>
    fetch(`${BASE}/presets`, { headers: authHeaders() }).then((r) =>
      jsonOrThrow<PresetIndex>(r)
    ),

  applyPreset: (name: string) =>
    fetch(`${BASE}/preset`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name }),
    }).then((r) => jsonOrThrow<ApplyPresetResponse>(r)),

  listUserPresets: () =>
    fetch(`${BASE}/presets/user`, { headers: authHeaders() }).then((r) =>
      jsonOrThrow<PresetIndex>(r)
    ),

  saveUserPreset: (name: string) =>
    fetch(`${BASE}/presets/user/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => jsonOrThrow<SaveUserPresetResponse>(r)),

  applyUserPreset: (name: string) =>
    fetch(`${BASE}/presets/user/${encodeURIComponent(name)}/apply`, {
      method: "POST",
      headers: authHeaders(),
    }).then((r) => jsonOrThrow<ApplyPresetResponse>(r)),

  deleteUserPreset: (name: string) =>
    fetch(`${BASE}/presets/user/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((r) => jsonOrThrow<DeleteUserPresetResponse>(r)),
};

// ---------- WebSocket ----------

export interface EventStreamHandlers {
  onHeartbeat?: (e: HeartbeatEvent) => void;
  onNoteOn?: (e: NoteOnEvent) => void;
  onNoteOff?: (e: NoteOffEvent) => void;
  onGpioPress?: (e: GpioPressEvent) => void;
  onGpioRelease?: (e: GpioReleaseEvent) => void;
  onOpen?: () => void;
  onClose?: (reason: string) => void;
  onError?: (err: Event) => void;
}

/**
 * Open the Pi's `/events` WebSocket. Browsers can't add Authorization headers
 * to native WebSockets, so the token rides in the query string; the server
 * matches it from there.
 */
export function openEventStream(handlers: EventStreamHandlers): WebSocket {
  const wsBase = BASE.replace(/^http/, "ws");
  const url = `${wsBase}/events${TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : ""}`;
  const ws = new WebSocket(url);
  ws.onopen = () => handlers.onOpen?.();
  ws.onerror = (err) => handlers.onError?.(err);
  ws.onclose = (ev) =>
    handlers.onClose?.(`closed code=${ev.code} reason=${ev.reason || "?"}`);
  ws.onmessage = (evt) => {
    try {
      const e = JSON.parse(evt.data) as EventMessage;
      if (e.type === "heartbeat") handlers.onHeartbeat?.(e);
      else if (e.type === "note_on") handlers.onNoteOn?.(e);
      else if (e.type === "note_off") handlers.onNoteOff?.(e);
      else if (e.type === "gpio_press") handlers.onGpioPress?.(e);
      else if (e.type === "gpio_release") handlers.onGpioRelease?.(e);
    } catch {
      // Malformed payload — log and continue. The Pi shouldn't be sending
      // these but defensive parsing keeps the stream alive if it does.
    }
  };
  return ws;
}
