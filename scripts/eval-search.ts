/**
 * Manual retrieval benchmark for semantic sample search — the sized-down
 * version of the Tonality plan's "retrieval benchmark". Prints top-3 results
 * per query for human judgment; run before/after embedding or attribute
 * changes to spot regressions.
 *
 * Decision gate (ML roadmap): if top-3 relevance reads below ~70%, that's the
 * trigger to add CLAP audio embeddings (kind='audio') alongside text.
 *
 * Requires OPENAI_API_KEY + SUPABASE_SERVICE_ROLE_KEY.
 * Usage: npx tsx scripts/eval-search.ts
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

import { EMBEDDING_MODEL } from "../lib/ai/embedding";

const QUERIES = [
  // timbre / character
  "woody and plaintive",
  "warm dark brass",
  "bright shimmering bells",
  "cold metallic texture",
  "smooth mellow low strings",
  "sharp aggressive attack",
  "soft breathy flute",
  "deep resonant bass drone",
  // mood / scene
  "rainy afternoon by the window",
  "epic battle scene",
  "jazz club at midnight",
  "peaceful morning meditation",
  "creepy haunted house",
  "triumphant fanfare",
  "lonely desert wind",
  "childlike wonder and play",
  // instrument-ish
  "plucked strings like a harp",
  "punchy 80s drums",
  "church organ grandeur",
  "solo cello lament",
  "muted trumpet noir",
  "glassy electric piano",
  // functional
  "something to loop under a melody",
  "short percussive hit for rhythm",
  "long sustained pad for ambience",
  "delicate intro sound",
  "big cinematic ending",
  "quirky sound effect",
] as const;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const { count } = await supabase
    .from("sample_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("kind", "description")
    .eq("archived", false);
  console.log(`Embeddings in index: ${count ?? 0}\n`);
  if (!count) {
    console.error("No embeddings — run scripts/embed-samples.ts first.");
    process.exit(1);
  }

  const { embeddings } = await embedMany({
    model: openai.textEmbeddingModel(EMBEDDING_MODEL),
    values: [...QUERIES],
  });

  for (let i = 0; i < QUERIES.length; i++) {
    const { data, error } = await supabase.rpc("search_samples_semantic", {
      query_embedding: JSON.stringify(embeddings[i]),
      match_count: 3,
      filter_family: null,
    });
    if (error) {
      console.error(`"${QUERIES[i]}" → rpc error: ${error.message}`);
      continue;
    }
    console.log(`"${QUERIES[i]}"`);
    for (const m of (data ?? []) as { sample_id: string; score: number }[]) {
      console.log(`   ${(m.score * 100).toFixed(0).padStart(3)}%  ${m.sample_id}`);
    }
    console.log();
  }

  console.log(
    "Judge each query's top-3 by ear/metadata. Rough pass bar: ≥70% of queries " +
      "have at least 2 plausible hits. Below that → consider CLAP audio embeddings.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
