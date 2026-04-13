/**
 * Workbench-voice formatting helpers — lowercase, compact, monospace-friendly.
 * Kept deliberately terse so the specimen-catalog tone stays consistent.
 */

export function timeAgo(dateStr: string | Date | null): string {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * Render a sample/recording id in specimen-catalog style: `SMP_0X4F7A`.
 * Takes the first 4 hex-ish chars of the id, uppercases.
 * Falls back to the raw id if it's short.
 */
export function formatSampleId(id: string, prefix: "SMP" | "REC" | "SE" = "SMP"): string {
  const clean = id.replace(/-/g, "").toUpperCase();
  const short = clean.slice(0, 4);
  return `${prefix}_0X${short}`;
}

/** Format seconds as `M:SS.mmm` (e.g. 0:04.328). */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.000";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/** Format seconds as compact duration for listings: `17.1s` / `2:14`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0.0s";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
