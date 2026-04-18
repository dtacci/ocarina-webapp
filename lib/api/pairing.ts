import { randomInt } from "crypto";

export const PAIRING_TTL_MIN = 10;
export const ANNOUNCE_RATE_LIMIT_PER_HOUR = 10;
export const MAX_CLAIM_ATTEMPTS = 5;

/**
 * Extract the client's public IP from request headers.
 * On Vercel, the left-most `x-forwarded-for` entry is the original client IP.
 * Falls back to null when the header is absent (local dev / direct calls).
 */
export function getClientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  return real?.trim() || null;
}

/** Generate a random 6-digit numeric pairing code as "XXXXXX". */
export function generatePairingCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Normalize user input ("482-651", "482 651", "482651") to "482651". */
export function normalizePairingCode(input: string): string {
  return input.replace(/\D/g, "");
}
