/**
 * Embed sample descriptions into sample_embeddings (pgvector) for semantic
 * search. Composite text = canonical description + vibes + family +
 * attribute adjectives (lib/ai/embedding.ts), embedded with OpenAI
 * text-embedding-3-small (~$0.03 for the full library).
 *
 * Idempotent: rows whose content_hash is unchanged are skipped, so re-runs
 * after description edits or attribute refreshes only embed what changed.
 *
 * Requires OPENAI_API_KEY (embeddings only — chat models stay on Anthropic).
 *
 * Usage:
 *   npx tsx scripts/embed-samples.ts             # embed everything pending
 *   npx tsx scripts/embed-samples.ts --limit 20  # smoke test
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  compositeText,
  contentHash,
  EMBEDDING_MODEL,
  type EmbeddableSample,
} from "../lib/ai/embedding";

const BATCH = 100; // texts per embedding call

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error(
    "Missing OPENAI_API_KEY — embeddings use OpenAI text-embedding-3-small.\n" +
      "Add it to .env.local (search falls back to filter-only without embeddings).",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

interface WorkItem {
  sampleId: string;
  text: string;
  hash: string;
}

async function pageAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

async function buildWorklist(): Promise<WorkItem[]> {
  const descriptions = await pageAll<{ sample_id: string; text: string }>((from, to) =>
    supabase
      .from("sample_descriptions")
      .select("sample_id, text")
      .eq("is_canonical", true)
      .is("deleted_at", null)
      .order("sample_id")
      .range(from, to),
  );
  console.log(`${descriptions.length} canonical descriptions`);

  const samples = await pageAll<Record<string, unknown>>((from, to) =>
    supabase
      .from("samples")
      .select(
        "id, title, family, category, root_note, duration_sec, brightness, warmth, attack, sustain, texture",
      )
      .order("id")
      .range(from, to),
  );
  const sampleById = new Map(samples.map((s) => [s.id as string, s]));

  const vibeRows = await pageAll<{ sample_id: string; vibe: string }>((from, to) =>
    supabase.from("sample_vibes").select("sample_id, vibe").order("sample_id").range(from, to),
  );
  const vibesById = new Map<string, string[]>();
  for (const row of vibeRows) {
    const list = vibesById.get(row.sample_id) ?? [];
    list.push(row.vibe);
    vibesById.set(row.sample_id, list);
  }

  const existing = await pageAll<{ sample_id: string; content_hash: string }>((from, to) =>
    supabase
      .from("sample_embeddings")
      .select("sample_id, content_hash")
      .eq("kind", "description")
      .eq("model", EMBEDDING_MODEL)
      .order("sample_id")
      .range(from, to),
  );
  const hashById = new Map(existing.map((e) => [e.sample_id, e.content_hash]));

  const work: WorkItem[] = [];
  for (const d of descriptions) {
    const s = sampleById.get(d.sample_id);
    if (!s) continue;
    const embeddable: EmbeddableSample = {
      id: s.id as string,
      title: s.title as string | null,
      family: s.family as string | null,
      category: s.category as string | null,
      rootNote: s.root_note as string | null,
      durationSec: s.duration_sec as number,
      vibes: vibesById.get(d.sample_id) ?? [],
      brightness: s.brightness as number | null,
      warmth: s.warmth as number | null,
      attack: s.attack as number | null,
      sustain: s.sustain as number | null,
      texture: s.texture as number | null,
    };
    const text = compositeText(embeddable, d.text);
    const hash = contentHash(text);
    if (hashById.get(d.sample_id) === hash) continue; // unchanged
    work.push({ sampleId: d.sample_id, text, hash });
  }
  return work;
}

async function main() {
  const work = (await buildWorklist()).slice(
    0,
    Number.isFinite(LIMIT) ? LIMIT : undefined,
  );
  console.log(`${work.length} samples to embed (model: ${EMBEDDING_MODEL})`);
  if (work.length === 0) return;

  let written = 0;
  let tokens = 0;

  for (let i = 0; i < work.length; i += BATCH) {
    const batch = work.slice(i, i + BATCH);
    const { embeddings, usage } = await embedMany({
      model: openai.textEmbeddingModel(EMBEDDING_MODEL),
      values: batch.map((w) => w.text),
    });
    tokens += usage?.tokens ?? 0;

    const rows = batch.map((w, j) => ({
      sample_id: w.sampleId,
      kind: "description",
      model: EMBEDDING_MODEL,
      content_hash: w.hash,
      embedding: JSON.stringify(embeddings[j]),
      archived: false,
    }));

    const { error } = await supabase
      .from("sample_embeddings")
      .upsert(rows, { onConflict: "sample_id,kind,model" });
    if (error) {
      console.error(`upsert failed at batch ${i}:`, error.message);
      continue;
    }

    written += rows.length;
    // text-embedding-3-small: $0.02 / MTok
    process.stdout.write(
      `\r${written}/${work.length} embedded — est. cost $${((tokens / 1e6) * 0.02).toFixed(3)}   `,
    );
  }

  console.log(
    `\nDone. ${written} embeddings; ${tokens} tokens ≈ $${((tokens / 1e6) * 0.02).toFixed(3)}.`,
  );
  console.log("Verify: npx tsx scripts/eval-search.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
