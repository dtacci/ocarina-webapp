import { createAdminClient } from "@/lib/supabase/admin";
import { deezerSongId, type DeezerTrack } from "@/lib/deezer";

/**
 * Song catalog cache (the `songs` table). Service-role only — callers (API
 * routes) session-auth first. Search warms the cache without clobbering rows
 * already enriched with bpm/isrc; selecting a track does a full upsert with the
 * complete, freshly-fetched metadata (incl. a non-expired preview url).
 */

export interface SongRow {
  id: string;
  source: string;
  deezer_id: number | null;
  isrc: string | null;
  title: string;
  artist: string;
  album: string | null;
  album_art_url: string | null;
  preview_url: string | null;
  duration_sec: number | null;
  deezer_bpm: number | null;
}

/** Camel-cased shape returned by the API routes / consumed by the client. */
export interface SongDto {
  id: string;
  source: string;
  title: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  previewUrl: string | null;
  durationSec: number | null;
  bpm: number | null;
  isrc: string | null;
}

const SONG_COLUMNS =
  "id, source, deezer_id, isrc, title, artist, album, album_art_url, preview_url, duration_sec, deezer_bpm";

export function songRowToDto(row: SongRow): SongDto {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    artist: row.artist,
    album: row.album,
    albumArtUrl: row.album_art_url,
    previewUrl: row.preview_url,
    durationSec: row.duration_sec,
    bpm: row.deezer_bpm,
    isrc: row.isrc,
  };
}

function trackToRow(track: DeezerTrack) {
  return {
    id: deezerSongId(track.deezerId),
    source: "deezer",
    deezer_id: track.deezerId,
    isrc: track.isrc,
    title: track.title,
    artist: track.artist,
    album: track.album,
    album_art_url: track.albumArtUrl,
    preview_url: track.previewUrl,
    duration_sec: track.durationSec,
    deezer_bpm: track.bpm,
  };
}

/** Extract the numeric Deezer id from a 'deezer:<id>' song id. */
export function parseDeezerSongId(songId: string): number | null {
  const [source, raw] = songId.split(":");
  if (source !== "deezer" || !raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Warm the catalog from search results — insert new rows only
 * (`ignoreDuplicates`), so rows previously enriched with bpm/isrc by getSong
 * aren't overwritten with the nulls a search payload carries.
 */
export async function cacheSongsFromSearch(tracks: DeezerTrack[]): Promise<void> {
  if (!tracks.length) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("songs")
    .upsert(tracks.map(trackToRow), { onConflict: "id", ignoreDuplicates: true });
  if (error) console.error("cacheSongsFromSearch failed:", error.message);
}

/** Full upsert from a complete per-track fetch (bpm/isrc + fresh preview url). */
export async function upsertSong(track: DeezerTrack): Promise<SongRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("songs")
    .upsert(trackToRow(track), { onConflict: "id" })
    .select(SONG_COLUMNS)
    .single();
  if (error) throw new Error(`upsertSong failed: ${error.message}`);
  return data as SongRow;
}

export async function getSong(id: string): Promise<SongRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("songs")
    .select(SONG_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getSong failed: ${error.message}`);
  return (data as SongRow) ?? null;
}
