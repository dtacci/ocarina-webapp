#!/usr/bin/env tsx
/**
 * Seed karaoke MIDI files to Vercel Blob + Supabase — runs from Mac, no Pi needed.
 *
 * Reads .mid files from ../digital-ocarina/karaoke/midi/ (or --dir), matches each
 * filename stem to a karaoke_songs row by title-slug prefix, uploads to Vercel Blob,
 * and updates midi_blob_url + available=true in Supabase.
 *
 * Resumable: skips songs with midi_blob_url already set.
 * ~888 files × 50KB = 44MB, estimate 3–5 min on typical home WiFi.
 *
 * Usage (from webapp root):
 *   npx tsx scripts/seed-karaoke-midi.ts                 # all files
 *   npx tsx scripts/seed-karaoke-midi.ts --limit 10      # test with 10 files
 *   npx tsx scripts/seed-karaoke-midi.ts --dry-run       # preview matches, no upload
 *   npx tsx scripts/seed-karaoke-midi.ts --dir /path     # custom MIDI dir
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BLOB_READ_WRITE_TOKEN
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { config } from "dotenv";
import { put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

// Load env
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
// BLOB_TOKEN only required for real uploads — dry-runs can proceed without it
// to verify match logic. Get token at: https://vercel.com/dashboard → Storage → Blob → Your store → .env.local

// CLI flags
const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const dirIdx = args.indexOf("--dir");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const DRY_RUN = args.includes("--dry-run");
const DEFAULT_MIDI_DIR = "/Users/dantacci/vibecode/digital-ocarina/karaoke/midi";
const MIDI_DIR = dirIdx >= 0 ? args[dirIdx + 1] : DEFAULT_MIDI_DIR;

// Supabase admin
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // List MIDI files
  let files: string[];
  try {
    files = readdirSync(MIDI_DIR)
      .filter((f) => f.toLowerCase().endsWith(".mid") || f.toLowerCase().endsWith(".midi"))
      .sort();
  } catch (e) {
    console.error(`ERROR: Cannot read directory ${MIDI_DIR}:`, (e as Error).message);
    process.exit(1);
  }
  if (LIMIT < files.length) files = files.slice(0, LIMIT);

  console.log(`Karaoke MIDI seed`);
  console.log(`  Directory: ${MIDI_DIR}`);
  console.log(`  Files:     ${files.length}${DRY_RUN ? "  (DRY RUN)" : ""}`);
  console.log();

  // Pre-fetch all karaoke_songs rows for matching (one query, faster)
  const { data: allSongs, error: songsErr } = await supabase
    .from("karaoke_songs")
    .select("id, title, artist, midi_blob_url");
  if (songsErr || !allSongs) {
    console.error("ERROR: Failed to fetch karaoke_songs:", songsErr);
    process.exit(1);
  }
  console.log(`  Songs in DB: ${allSongs.length}`);
  const alreadyHave = allSongs.filter((s) => s.midi_blob_url).length;
  console.log(`  Already have MIDI: ${alreadyHave}`);
  console.log();

  // Index songs by id for fast lookup
  // DB id formats observed:
  //   "title-slug-artist-slug"  (e.g., "bohemian-rhapsody-queen")
  //   "unknown-title-slug"       (e.g., "unknown-a-night-in-tunisia")
  // File stem:
  //   "title-slug"               (e.g., "a-kind-of-magic")
  //
  // Match priority:
  //   1. Exact "unknown-{stem}" match (MIDI-source rows, 1:1 correspondence)
  //   2. Prefix "{stem}-{anything}" match (wishlist curated rows)
  type DbSong = typeof allSongs[number];
  const songsById = new Map<string, DbSong>();
  const songsByTitlePrefix = new Map<string, DbSong[]>();
  for (const song of allSongs) {
    songsById.set(song.id, song);
    const parts = song.id.split("-");
    for (let n = 1; n < parts.length; n++) {
      const prefix = parts.slice(0, n).join("-");
      if (!songsByTitlePrefix.has(prefix)) songsByTitlePrefix.set(prefix, []);
      songsByTitlePrefix.get(prefix)!.push(song);
    }
  }

  function findMatchingSong(fileStem: string): DbSong | null {
    // 1. Try exact "unknown-{stem}" match
    const unknownMatch = songsById.get(`unknown-${fileStem}`);
    if (unknownMatch) return unknownMatch;

    // 2. Try prefix match (title in curated wishlist)
    const candidates = songsByTitlePrefix.get(fileStem) ?? [];
    const prefixMatches = candidates.filter((s) => s.id.startsWith(fileStem + "-"));
    // Prefer ones without midi_blob_url set
    prefixMatches.sort((a, b) => (a.midi_blob_url ? 1 : 0) - (b.midi_blob_url ? 1 : 0));
    return prefixMatches[0] ?? null;
  }

  let uploaded = 0, skipped = 0, nomatch = 0, errors = 0;
  const start = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const stem = basename(file, extname(file));
    const progress = `[${String(i + 1).padStart(3)}/${files.length}]`;
    process.stdout.write(`${progress} ${stem.slice(0, 55).padEnd(55)}  `);

    const match = findMatchingSong(stem);
    if (!match) {
      console.log("NO MATCH");
      nomatch++;
      continue;
    }

    if (match.midi_blob_url) {
      console.log(`skip (already set)  → ${match.id}`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`would upload → ${match.id}`);
      continue;
    }

    if (!BLOB_TOKEN) {
      console.error("\nERROR: BLOB_READ_WRITE_TOKEN is empty. Get it from the Vercel dashboard:");
      console.error("  https://vercel.com/dashboard → Storage → Blob → Your store → .env.local");
      console.error("  Or run: `vercel env pull .env.local` if you have vercel CLI linked");
      process.exit(1);
    }

    const fullPath = join(MIDI_DIR, file);
    const buf = readFileSync(fullPath);
    const sizeKb = Math.round(buf.length / 1024);

    try {
      // Upload to Vercel Blob
      const blob = await put(
        `karaoke/midi/${stem}.mid`,
        buf,
        {
          access: "public",
          contentType: "audio/midi",
          addRandomSuffix: true,
          token: BLOB_TOKEN,
        }
      );

      // Update karaoke_songs
      const { error: updateErr } = await supabase
        .from("karaoke_songs")
        .update({ midi_blob_url: blob.url, available: true })
        .eq("id", match.id);

      if (updateErr) {
        console.log(`DB UPDATE FAILED: ${updateErr.message}`);
        errors++;
        continue;
      }

      const elapsed = (Date.now() - start) / 1000;
      const rate = (i + 1) / elapsed;
      const eta = (files.length - i - 1) / rate / 60;
      console.log(`✓ ${sizeKb}KB → ${match.id}  (ETA ${eta.toFixed(1)}m)`);
      uploaded++;
    } catch (e) {
      console.log(`UPLOAD ERROR: ${(e as Error).message}`);
      errors++;
    }
  }

  console.log();
  console.log(`Done in ${((Date.now() - start) / 1000 / 60).toFixed(1)} minutes`);
  console.log(`  ✓ Uploaded:  ${uploaded}`);
  console.log(`  - Skipped:   ${skipped}`);
  console.log(`  ? No match:  ${nomatch}`);
  console.log(`  ✗ Errors:    ${errors}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
