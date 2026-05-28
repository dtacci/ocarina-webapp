/**
 * Thin helper for the Pi's FastAPI base URL. Reserved for the upcoming
 * Pi-REST integration that will eventually replace the WebSerial flow.
 *
 * Today this only exposes the configured URL — the actual `fetch` calls and
 * typed endpoints land alongside the Pi-side FastAPI work (separate repo).
 */

const RAW = process.env.NEXT_PUBLIC_OCARINA_API ?? "";

/**
 * Configured Pi base URL, or null when unset / empty. Trailing slash stripped.
 *
 * Local dev: http://ocarina.local:8000
 * Production: a Tailscale Funnel or Cloudflare Tunnel URL (HTTPS-from-HTTPS
 * requirement; the page is served from Vercel over HTTPS and browsers block
 * mixed-content fetches).
 */
export const PI_API_BASE: string | null = RAW
  ? RAW.replace(/\/+$/, "")
  : null;

export function isPiApiConfigured(): boolean {
  return PI_API_BASE !== null;
}
