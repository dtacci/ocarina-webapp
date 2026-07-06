import { randomUUID } from "crypto";
import { generateObject } from "ai";

import { getModel, getProvider } from "@/lib/ai/provider";
import { sampleSearchSchema } from "@/lib/ai/schemas";
import { SAMPLE_SEARCH_SYSTEM } from "@/lib/ai/prompts";
import { embedText, embeddingsAvailable, EMBEDDING_MODEL } from "@/lib/ai/embedding";
import { logAiInvocation } from "@/lib/ai/log-invocation";
import { semanticSampleSearch, type SemanticResult } from "@/lib/db/queries/semantic-search";
import { logInteraction } from "@/lib/events/log";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Hybrid AI sample search:
 *  - LLM filter extraction (vibes/family/attribute ranges) — original behavior
 *  - pgvector cosine ranking over Claude-generated sample descriptions
 * Falls back to filter-only when embeddings aren't available (no OpenAI key
 * or empty sample_embeddings).
 *
 * Every search logs an ai_invocations row + a search_executed interaction
 * event; the response carries query_id so the client can attribute
 * play/skip/rating outcomes (docs/EVENTS.md).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query } = await request.json();
  if (!query || typeof query !== "string" || query.length > 500) {
    return Response.json({ error: "Invalid query" }, { status: 400 });
  }

  const provider = await getProvider();
  const model = await getModel("search");
  const started = Date.now();

  // Filter extraction and query embedding are independent — run them together.
  const [filtersResult, embeddingResult] = await Promise.allSettled([
    generateObject({
      model,
      schema: sampleSearchSchema,
      system: SAMPLE_SEARCH_SYSTEM,
      prompt: query,
    }),
    embeddingsAvailable() ? embedText(query) : Promise.resolve(null),
  ]);

  if (filtersResult.status === "rejected") {
    void logAiInvocation({
      userId: user.id,
      feature: "search",
      provider,
      model: model.modelId,
      request: { query },
      latencyMs: Date.now() - started,
      error: String(filtersResult.reason),
    });
    return Response.json({ error: "Search failed" }, { status: 502 });
  }

  const filters = filtersResult.value.object;
  const usage = filtersResult.value.usage;

  // Vector ranking — non-fatal: an embedding failure degrades to filter-only.
  let results: SemanticResult[] = [];
  let semantic = false;
  if (embeddingResult.status === "fulfilled" && embeddingResult.value) {
    try {
      results = await semanticSampleSearch(embeddingResult.value, {
        limit: 10,
        family: filters.family,
      });
      semantic = results.length > 0;
    } catch (err) {
      console.error("semantic search failed, falling back to filters:", err);
    }
  }

  const queryId = randomUUID();

  void logAiInvocation({
    userId: user.id,
    feature: "search",
    provider,
    model: model.modelId,
    request: { query, embeddingModel: semantic ? EMBEDDING_MODEL : null },
    response: { filters, resultCount: results.length, semantic },
    latencyMs: Date.now() - started,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  });

  void logInteraction(
    { userId: user.id, source: "web" },
    {
      eventType: "search_executed",
      queryId,
      payload: {
        query_text: query,
        vibes: filters.vibes,
        family: filters.family,
        semantic,
        results: results.map((r) => ({
          sample_id: r.sampleId,
          score: r.score,
          rank: r.rank,
        })),
      },
    },
  );

  return Response.json({
    ...filters,
    queryId,
    semantic,
    results,
  });
}
