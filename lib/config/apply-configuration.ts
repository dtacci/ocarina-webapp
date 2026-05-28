/**
 * Single entry point for pushing configurator changes to a device. Today both
 * modes route through PATCH /api/sync/config (Apply semantics — persisted +
 * queued per-key as set_config_field commands). The `live` branch is a
 * placeholder for future per-slider instant pushes through /api/sync/commands.
 */

export type ApplyMode = "apply" | "live";

export interface ApplyArgs {
  deviceId: string;
  /** Top-level config keys to merge. Values may be primitives or nested objects. */
  changes: Record<string, unknown>;
  mode?: ApplyMode;
}

export interface ApplyResult {
  version: number;
  queued: number;
}

export async function applyConfiguration({
  deviceId,
  changes,
  mode = "apply",
}: ApplyArgs): Promise<ApplyResult> {
  if (Object.keys(changes).length === 0) {
    throw new Error("applyConfiguration: nothing to change");
  }

  if (mode === "live") {
    // Reserved for future use — would POST individual commands to /api/sync/commands
    // for instant per-control pushes without bumping config version.
    // Falls through to "apply" today so the seam is real but not yet a behavior split.
  }

  const res = await fetch("/api/sync/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, changes }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`apply failed (${res.status}): ${body || res.statusText}`);
  }

  return (await res.json()) as ApplyResult;
}
