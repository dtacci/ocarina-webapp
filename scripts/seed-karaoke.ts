/**
 * Seed karaoke songs from digital-ocarina catalog.json + MIDI file scan.
 * Merges 199 wishlist entries with 888 discovered MIDI files.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-karaoke.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ocarinRoot = resolve(__dirname, "../../digital-ocarina");

interface CatalogEntry {
  id: string;
  title: string;
  artist: string;
  decade: string;
  genre: string[];
  tags: string[];
  duration_sec: number;
  key: string;
  file: string;
  available: boolean;
}

function parseMidiFilename(filename: string): { artist: string; title: string } {
  // Format: artist-name--song-title.mid
  const base = filename.replace(/\.mid$/i, "");
  const parts = base.split("--");
  if (parts.length === 2) {
    return {
      artist: parts[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      title: parts[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  }
  return { artist: "Unknown", title: base.replace(/-/g, " ") };
}

function toId(artist: string, title: string): string {
  return `${artist}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function guessDecade(title: string, artist: string): string {
  // Very rough heuristics based on well-known artists
  const decades: Record<string, string> = {
    "queen": "70s", "beatles": "60s", "led zeppelin": "70s",
    "michael jackson": "80s", "elton john": "70s", "sting": "80s",
    "police": "80s", "abba": "70s", "bee gees": "70s",
    "nirvana": "90s", "oasis": "90s", "radiohead": "90s",
    "adele": "2010s", "ed sheeran": "2010s", "coldplay": "2000s",
  };
  const lower = artist.toLowerCase();
  for (const [key, decade] of Object.entries(decades)) {
    if (lower.includes(key)) return decade;
  }
  return "unknown";
}

async function seed() {
  // 1. Load catalog.json (199 wishlist entries)
  const catalogPath = resolve(ocarinRoot, "karaoke/catalog.json");
  let catalog: CatalogEntry[] = [];
  try {
    catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));
    console.log(`Loaded ${catalog.length} catalog entries`);
  } catch {
    console.log("No catalog.json found, continuing with MIDI scan only");
  }

  // 2. Scan MIDI files (888 songs)
  const midiDir = resolve(ocarinRoot, "karaoke/midi");
  let midiFiles: string[] = [];
  try {
    midiFiles = readdirSync(midiDir).filter((f) => f.endsWith(".mid") || f.endsWith(".MID"));
    console.log(`Found ${midiFiles.length} MIDI files`);
  } catch {
    console.log("No MIDI directory found");
  }

  // 3. Build merged song map
  const songMap = new Map<string, Record<string, unknown>>();

  // Add catalog entries first
  for (const entry of catalog) {
    songMap.set(entry.id, {
      id: entry.id,
      title: entry.title,
      artist: entry.artist,
      decade: entry.decade,
      genre: entry.genre,
      tags: entry.tags,
      duration_sec: entry.duration_sec || null,
      key: entry.key || null,
      source: entry.available ? "wav" : "midi",
      available: true, // We'll have MIDI for most
    });
  }

  // Add/merge MIDI files
  for (const file of midiFiles) {
    const { artist, title } = parseMidiFilename(file);
    const id = toId(artist, title);

    if (songMap.has(id)) {
      // Merge: mark as available with MIDI source
      const existing = songMap.get(id)!;
      existing.source = existing.source === "wav" ? "both" : "midi";
      existing.available = true;
    } else {
      songMap.set(id, {
        id,
        title,
        artist,
        decade: guessDecade(title, artist),
        genre: [],
        tags: [],
        duration_sec: null,
        key: null,
        source: "midi",
        available: true,
      });
    }
  }

  const songs = Array.from(songMap.values());
  console.log(`Total unique songs: ${songs.length}`);

  // 4. Insert in batches
  for (let i = 0; i < songs.length; i += 100) {
    const batch = songs.slice(i, i + 100);
    const { error } = await supabase.from("karaoke_songs").upsert(batch, {
      onConflict: "id",
    });
    if (error) {
      console.error(`Batch ${i / 100 + 1} failed:`, error.message);
    } else {
      console.log(`Batch ${i / 100 + 1}: ${batch.length} songs upserted`);
    }
  }

  console.log("Done!");
}

seed().catch(console.error);
