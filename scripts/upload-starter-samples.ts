/**
 * Upload a curated "starter pack" of system samples to Vercel Blob and point
 * their DB rows at real URLs.
 *
 * Background: seed-samples.ts inserted ~3.9k system rows with PLACEHOLDER
 * blob_urls (`samples/<repo-relative-path>`) — nothing in the library is
 * actually fetchable/playable. This script picks a diverse subset per family,
 * transcodes the source WAVs from the digital-ocarina repo (PCM16/44.1k WAV +
 * 128k MP3 preview via local ffmpeg), computes 200-point peaks, uploads both
 * blobs, and updates the rows in place (blob_url, mp3_blob_url,
 * waveform_peaks, duration_sec, sample_rate, title).
 *
 * Idempotent: rows whose blob_url already starts with http are skipped, so
 * re-runs only fill gaps. Requires ffmpeg on PATH and BLOB_READ_WRITE_TOKEN +
 * Supabase service env in .env.local.
 *
 * Usage:
 *   npx tsx scripts/upload-starter-samples.ts            # 8 per family
 *   npx tsx scripts/upload-starter-samples.ts --per-family 12
 *   npx tsx scripts/upload-starter-samples.ts --dry-run
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

config({ path: ".env.local", quiet: true });

const OCARINA_SAMPLES = resolve(__dirname, "../../digital-ocarina/samples");
const PER_FAMILY = (() => {
  const i = process.argv.indexOf("--per-family");
  return i >= 0 ? Number(process.argv[i + 1]) : 8;
})();
const DRY_RUN = process.argv.includes("--dry-run");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

interface Row {
  id: string;
  blob_url: string;
  family: string;
  title: string | null;
  duration_sec: number | null;
}

/** "zap2" / "violin_G3_sustain" → "Zap 2" / "Violin G3 Sustain". */
function titleFromId(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Decode via ffmpeg to mono f32 PCM and compute 200 max-abs peak buckets. */
function computePeaks(src: string): { peaks: number[]; durationSec: number } {
  const RATE = 8000;
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", src, "-ac", "1", "-ar", String(RATE), "-f", "f32le", "pipe:1"],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  const f32 = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  const n = f32.length;
  const peaks: number[] = [];
  const bucket = Math.max(1, Math.floor(n / 200));
  for (let b = 0; b < 200; b++) {
    let max = 0;
    for (let i = b * bucket; i < Math.min((b + 1) * bucket, n); i++) {
      max = Math.max(max, Math.abs(f32[i]));
    }
    peaks.push(Number(max.toFixed(4)));
  }
  return { peaks, durationSec: n / RATE };
}

async function main() {
  // ── curate: N per family among rows still on placeholder URLs ────────────
  const { data: families, error: famErr } = await supabase
    .from("samples")
    .select("family")
    .eq("is_system", true)
    .not("family", "is", null);
  if (famErr) throw new Error(famErr.message);
  const familyNames = [...new Set((families ?? []).map((f) => f.family as string))];

  const picked: Row[] = [];
  for (const fam of familyNames) {
    // Fill TO the quota: families that already have fetchable samples only
    // get the difference, so re-runs top up instead of stacking.
    const { count: fetchable } = await supabase
      .from("samples")
      .select("*", { count: "exact", head: true })
      .eq("is_system", true)
      .eq("family", fam)
      .like("blob_url", "http%");
    const quota = Math.max(0, PER_FAMILY - (fetchable ?? 0));
    if (quota === 0) continue;
    // Page through the whole family (PostgREST caps single responses at 1k).
    const all: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("samples")
        .select("id,blob_url,family,title,duration_sec")
        .eq("is_system", true)
        .eq("family", fam)
        .not("blob_url", "like", "http%") // already-uploaded rows are done
        .gte("duration_sec", 0.3)
        .lte("duration_sec", 8)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    // Deterministic pseudo-shuffle on a hash of the id, then greedily prefer
    // unseen instrument prefixes ("violin_…", "bass-clarinet_…") so one
    // instrument's hundreds of takes can't fill the whole family quota.
    const shuffled = all
      .map((r) => ({ r, h: hash(r.id) }))
      .sort((a, b) => a.h - b.h)
      .map((x) => x.r);
    const prefix = (id: string) => id.split("_")[0];
    const chosen: Row[] = [];
    const seenPrefix = new Set<string>();
    for (const r of shuffled) {
      if (chosen.length >= quota) break;
      if (seenPrefix.has(prefix(r.id))) continue;
      seenPrefix.add(prefix(r.id));
      chosen.push(r);
    }
    for (const r of shuffled) {
      if (chosen.length >= quota) break;
      if (!chosen.includes(r)) chosen.push(r);
    }
    picked.push(...chosen);
  }

  console.log(`curated ${picked.length} samples across ${familyNames.length} families`);

  const tmp = mkdtempSync(join(tmpdir(), "starter-samples-"));
  let done = 0;
  const failures: string[] = [];

  for (const row of picked) {
    const rel = row.blob_url.replace(/^samples\//, "");
    // index.json paths are relative to varying roots of the samples tree.
    const src = ["", "raw", "processed", "organized"]
      .map((root) => join(OCARINA_SAMPLES, root, rel))
      .find(existsSync);
    if (!src) {
      failures.push(`${row.id}: source missing (${rel})`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry] ${row.family.padEnd(12)} ${row.id} ← ${rel}`);
      done++;
      continue;
    }
    try {
      const wavPath = join(tmp, `${row.id}.wav`);
      const mp3Path = join(tmp, `${row.id}.mp3`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-ar", "44100", "-sample_fmt", "s16", wavPath]);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "128k", mp3Path]);
      const { peaks, durationSec } = computePeaks(wavPath);

      const [wavBlob, mp3Blob] = await Promise.all([
        put(`system-samples/${row.id}.wav`, readFileSync(wavPath), {
          access: "public", contentType: "audio/wav", addRandomSuffix: true,
        }),
        put(`system-samples/${row.id}.mp3`, readFileSync(mp3Path), {
          access: "public", contentType: "audio/mpeg", addRandomSuffix: true,
        }),
      ]);

      const { error: upErr } = await supabase
        .from("samples")
        .update({
          blob_url: wavBlob.url,
          mp3_blob_url: mp3Blob.url,
          waveform_peaks: peaks,
          duration_sec: Number(durationSec.toFixed(3)),
          sample_rate: 44100,
          title: row.title ?? titleFromId(row.id),
        })
        .eq("id", row.id);
      if (upErr) throw new Error(upErr.message);

      done++;
      process.stdout.write(`\r${done}/${picked.length} uploaded (${row.id})${" ".repeat(20)}`);
    } catch (err) {
      failures.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  rmSync(tmp, { recursive: true, force: true });

  console.log(`\ndone: ${done} uploaded, ${failures.length} failed`);
  for (const f of failures.slice(0, 10)) console.log(`  FAIL ${f}`);

  const { count } = await supabase
    .from("samples")
    .select("*", { count: "exact", head: true })
    .eq("is_system", true)
    .like("blob_url", "http%");
  console.log(`system samples now fetchable: ${count}`);
}

/** Tiny deterministic string hash (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
