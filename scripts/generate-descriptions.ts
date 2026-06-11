/**
 * Backfill natural-language sample descriptions with Claude Haiku.
 *
 * Writes canonical rows to sample_descriptions (source='llm:<model>') and
 * logs every model call to ai_invocations. Idempotent: samples that already
 * have a canonical description are skipped, so it's safe to re-run after
 * interruptions.
 *
 * Cost: ~$5–10 one-off for the full library on Haiku ($1/$5 per MTok);
 * a running estimate is printed as it goes.
 *
 * Usage:
 *   npx tsx scripts/generate-descriptions.ts            # full run
 *   npx tsx scripts/generate-descriptions.ts --limit 20 # smoke test
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { createClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const MODEL_ID = "claude-haiku-4-5";
const BATCH = 10; // samples per model call

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const descriptionSchema = z.object({
  descriptions: z.array(
    z.object({
      id: z.string().describe("The sample id, copied exactly"),
      description: z
        .string()
        .describe("2–3 sentence music-librarian description of the sample"),
    }),
  ),
});

const SYSTEM = `You are a music librarian writing catalog descriptions for an orchestral sample library used by a voice-controlled instrument.

For each sample you receive (id + metadata), write a 2–3 sentence description capturing: the instrument and its register, the timbre/character (using the numeric attributes: brightness, warmth, attack, sustain, texture on a 1–10 scale), the mood it evokes, and what musical contexts it suits.

Write naturally — these descriptions are embedded for semantic search, so favor evocative, specific vocabulary over generic praise. Never invent details that contradict the metadata. Copy each sample's id exactly.`;

interface SampleRow {
  id: string;
  title: string | null;
  family: string | null;
  category: string | null;
  root_note: string | null;
  duration_sec: number;
  brightness: number | null;
  warmth: number | null;
  attack: number | null;
  sustain: number | null;
  texture: number | null;
}

async function fetchPendingSamples(): Promise<SampleRow[]> {
  // All samples minus those with a canonical description.
  const done = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("sample_descriptions")
      .select("sample_id")
      .eq("is_canonical", true)
      .is("deleted_at", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) done.add(row.sample_id);
    if (!data || data.length < 1000) break;
  }

  const pending: SampleRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("samples")
      .select(
        "id, title, family, category, root_note, duration_sec, brightness, warmth, attack, sustain, texture",
      )
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!done.has(row.id)) pending.push(row as SampleRow);
    }
    if (!data || data.length < 1000) break;
  }
  return pending;
}

async function fetchVibes(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const { data } = await supabase
    .from("sample_vibes")
    .select("sample_id, vibe")
    .in("sample_id", ids);
  for (const row of data ?? []) {
    const list = map.get(row.sample_id) ?? [];
    list.push(row.vibe);
    map.set(row.sample_id, list);
  }
  return map;
}

function renderSample(s: SampleRow, vibes: string[]): string {
  const attrs = (["brightness", "warmth", "attack", "sustain", "texture"] as const)
    .filter((a) => s[a] != null)
    .map((a) => `${a}=${s[a]}`)
    .join(", ");
  return [
    `id: ${s.id}`,
    s.title ? `title: ${s.title}` : null,
    `family: ${s.family ?? "unknown"}${s.category ? ` (${s.category})` : ""}`,
    s.root_note ? `root note: ${s.root_note}` : null,
    `duration: ${s.duration_sec.toFixed(1)}s`,
    attrs ? `attributes (1-10): ${attrs}` : null,
    vibes.length ? `vibes: ${vibes.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const pending = (await fetchPendingSamples()).slice(
    0,
    Number.isFinite(LIMIT) ? LIMIT : undefined,
  );
  console.log(`${pending.length} samples need descriptions (model: ${MODEL_ID})`);
  if (pending.length === 0) return;

  let written = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const vibesMap = await fetchVibes(batch.map((s) => s.id));
    const prompt = batch
      .map((s) => renderSample(s, vibesMap.get(s.id) ?? []))
      .join("\n\n---\n\n");

    const started = Date.now();
    let result;
    try {
      result = await generateObject({
        model: anthropic(MODEL_ID),
        schema: descriptionSchema,
        system: SYSTEM,
        prompt,
      });
    } catch (err) {
      console.error(`batch at ${i} failed, skipping:`, err);
      continue;
    }

    inputTokens += result.usage?.inputTokens ?? 0;
    outputTokens += result.usage?.outputTokens ?? 0;

    await supabase.from("ai_invocations").insert({
      feature: "describe",
      provider: "anthropic",
      model: MODEL_ID,
      request_jsonb: { sampleIds: batch.map((s) => s.id) },
      response_jsonb: result.object,
      latency_ms: Date.now() - started,
      input_tokens: result.usage?.inputTokens ?? null,
      output_tokens: result.usage?.outputTokens ?? null,
    });

    const validIds = new Set(batch.map((s) => s.id));
    const seen = new Set<string>(); // model occasionally repeats an id
    const rows = result.object.descriptions
      .filter((d) => {
        if (!validIds.has(d.id) || d.description.length < 20 || seen.has(d.id)) {
          return false;
        }
        seen.add(d.id);
        return true;
      })
      .map((d) => ({
        sample_id: d.id,
        text: d.description.trim(),
        source: `llm:${MODEL_ID}`,
        is_canonical: true,
      }));

    const { error } = await supabase.from("sample_descriptions").insert(rows);
    if (error) {
      console.error(`insert failed at batch ${i}:`, error.message);
      continue;
    }

    written += rows.length;
    // Haiku 4.5: $1/MTok in, $5/MTok out
    const cost = (inputTokens / 1e6) * 1 + (outputTokens / 1e6) * 5;
    process.stdout.write(
      `\r${written}/${pending.length} written — est. cost $${cost.toFixed(2)}   `,
    );
  }

  const cost = (inputTokens / 1e6) * 1 + (outputTokens / 1e6) * 5;
  console.log(
    `\nDone. ${written} descriptions; ${inputTokens} in / ${outputTokens} out tokens ≈ $${cost.toFixed(2)}.`,
  );
  console.log("Next: npx tsx scripts/embed-samples.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
