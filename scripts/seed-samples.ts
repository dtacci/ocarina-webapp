/**
 * Seed the samples + sample_vibes tables from the Digital Ocarina index.json.
 *
 * Uses the Supabase REST API (service role key) so it works even when
 * the direct Postgres connection isn't available.
 *
 * Usage: npx tsx scripts/seed-samples.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// --- Config ---
const OCARINA_REPO = resolve(__dirname, "../../digital-ocarina");
const INDEX_PATH = resolve(OCARINA_REPO, "samples/index.json");
const BATCH_SIZE = 500;

// --- Supabase admin client (bypasses RLS) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

interface RawSample {
  id: string;
  file: string;
  duration_sec: number;
  sample_rate: number;
  root_note: string | null;
  root_freq: number | null;
  brightness: number | null;
  attack: number | null;
  sustain: number | null;
  texture: number | null;
  category: string;
  family: string;
  warmth: number | null;
  loopable: boolean;
  vibes: string[];
  verified: boolean;
}

async function seedSamples() {
  console.log(`Reading index from ${INDEX_PATH}...`);
  const raw = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
  const samples: RawSample[] = raw.samples;
  console.log(`Found ${samples.length} samples with ${samples.reduce((s, x) => s + x.vibes.length, 0)} vibe entries`);

  // Deduplicate by ID (keep first occurrence)
  const seen = new Set<string>();
  const uniqueSamples = samples.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  console.log(`After dedup: ${uniqueSamples.length} unique samples (${samples.length - uniqueSamples.length} duplicates removed)`);

  // Check if already seeded
  const { count } = await supabase
    .from("samples")
    .select("*", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`Samples table already has ${count} rows. Skipping. Use --force to re-seed.`);
    if (!process.argv.includes("--force")) return;
    console.log("--force: deleting existing data...");
    await supabase.from("sample_vibes").delete().neq("sample_id", "");
    await supabase.from("samples").delete().neq("id", "");
  }

  // --- Insert samples in batches ---
  console.log(`\nInserting ${uniqueSamples.length} samples in batches of ${BATCH_SIZE}...`);
  let inserted = 0;
  for (let i = 0; i < uniqueSamples.length; i += BATCH_SIZE) {
    const batch = uniqueSamples.slice(i, i + BATCH_SIZE).map((s) => ({
      id: s.id,
      blob_url: `samples/${s.file}`, // placeholder until Vercel Blob upload
      duration_sec: s.duration_sec,
      sample_rate: s.sample_rate,
      root_note: s.root_note,
      root_freq: s.root_freq,
      brightness: s.brightness,
      attack: s.attack,
      sustain: s.sustain,
      texture: s.texture,
      warmth: s.warmth,
      category: s.category,
      family: s.family,
      loopable: s.loopable,
      verified: s.verified,
      is_system: true,
    }));

    const { error } = await supabase.from("samples").insert(batch);
    if (error) {
      console.error(`Error at batch ${i / BATCH_SIZE}:`, error.message);
      // Log first failing row for debugging
      console.error("First row in batch:", JSON.stringify(batch[0]).slice(0, 200));
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted}/${samples.length} samples`);
  }
  console.log(" ✓");

  // --- Insert vibes in batches ---
  const allVibes: { sample_id: string; vibe: string }[] = [];
  for (const s of uniqueSamples) {
    for (const v of s.vibes) {
      allVibes.push({ sample_id: s.id, vibe: v });
    }
  }

  console.log(`Inserting ${allVibes.length} vibes in batches of ${BATCH_SIZE}...`);
  let vibesInserted = 0;
  for (let i = 0; i < allVibes.length; i += BATCH_SIZE) {
    const batch = allVibes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("sample_vibes").insert(batch);
    if (error) {
      console.error(`Error at vibe batch ${i / BATCH_SIZE}:`, error.message);
      process.exit(1);
    }
    vibesInserted += batch.length;
    process.stdout.write(`\r  ${vibesInserted}/${allVibes.length} vibes`);
  }
  console.log(" ✓");

  console.log("\nDone! Seeded samples and vibes.");
}

seedSamples().catch((e) => {
  console.error(e);
  process.exit(1);
});
