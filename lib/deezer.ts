/**
 * Thin server-side wrappers around Deezer's public API (no auth/key required).
 *
 * Deezer's JSON API doesn't send CORS headers, so every call goes through our
 * route handlers (app/api/songs/*), never the browser. The /search endpoint
 * carries preview urls + basic metadata but NOT bpm/isrc — those come from the
 * per-track /track/<id> endpoint, fetched on selection. 30s preview urls are
 * publicly fetchable but expire after a few hours, so we re-fetch before use.
 */

const DEEZER_API = "https://api.deezer.com";
const UA = "DigitalOcarina/1.0 (https://github.com/dtacci/digital-ocarina)";
const REVALIDATE_SEC = 86400; // catalog metadata is stable day-to-day

export interface DeezerTrack {
  deezerId: number;
  title: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  previewUrl: string | null; // 30s mp3
  durationSec: number | null;
  bpm: number | null; // per-track only; Deezer often returns 0 -> null here
  isrc: string | null; // per-track only
}

interface DeezerSearchRaw {
  data?: Array<{
    id: number;
    title: string;
    duration?: number;
    preview?: string;
    artist?: { name?: string };
    album?: { title?: string; cover_medium?: string };
  }>;
  error?: { message?: string };
}

interface DeezerTrackRaw {
  id?: number;
  title?: string;
  duration?: number;
  preview?: string;
  bpm?: number;
  isrc?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_medium?: string };
  error?: { message?: string };
}

/** Stable internal id for a Deezer track: 'deezer:<id>'. */
export function deezerSongId(deezerId: number): string {
  return `deezer:${deezerId}`;
}

export async function searchDeezer(query: string, limit = 12): Promise<DeezerTrack[]> {
  const qs = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${DEEZER_API}/search?${qs.toString()}`, {
    headers: { "User-Agent": UA },
    next: { revalidate: REVALIDATE_SEC },
  });
  if (!res.ok) throw new Error(`Deezer search failed: ${res.status}`);
  const json = (await res.json()) as DeezerSearchRaw;
  if (json.error) throw new Error(`Deezer error: ${json.error.message ?? "unknown"}`);
  return (json.data ?? []).map((t) => ({
    deezerId: t.id,
    title: t.title,
    artist: t.artist?.name ?? "Unknown",
    album: t.album?.title ?? null,
    albumArtUrl: t.album?.cover_medium ?? null,
    previewUrl: t.preview || null,
    durationSec: t.duration ?? null,
    bpm: null, // not in the search payload
    isrc: null, // not in the search payload
  }));
}

export async function getDeezerTrack(deezerId: number): Promise<DeezerTrack | null> {
  const res = await fetch(`${DEEZER_API}/track/${deezerId}`, {
    headers: { "User-Agent": UA },
    next: { revalidate: REVALIDATE_SEC },
  });
  if (!res.ok) return null;
  const t = (await res.json()) as DeezerTrackRaw;
  if (t.error || !t.id || !t.title) return null;
  return {
    deezerId: t.id,
    title: t.title,
    artist: t.artist?.name ?? "Unknown",
    album: t.album?.title ?? null,
    albumArtUrl: t.album?.cover_medium ?? null,
    previewUrl: t.preview || null,
    durationSec: t.duration ?? null,
    bpm: t.bpm && t.bpm > 0 ? Math.round(t.bpm) : null,
    isrc: t.isrc || null,
  };
}
