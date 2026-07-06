import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vector-ranked sample search over description embeddings, via the
 * search_samples_semantic() RPC (drizzle/0013). Service-role only — callers
 * (API routes) must session-auth first.
 */

export interface SemanticResult {
  sampleId: string;
  score: number;
  rank: number;
  title: string | null;
  family: string | null;
  category: string | null;
  durationSec: number;
  mp3BlobUrl: string | null;
  vibes: string[];
  description: string | null;
}

export async function semanticSampleSearch(
  queryEmbedding: number[],
  opts: { limit?: number; family?: string | null } = {},
): Promise<SemanticResult[]> {
  const supabase = createAdminClient();
  const limit = opts.limit ?? 10;

  const { data: matches, error } = await supabase.rpc("search_samples_semantic", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: Math.max(limit * 2, 20), // headroom for joins/dedup
    filter_family: opts.family ?? null,
  });

  if (error) throw new Error(`semantic search rpc failed: ${error.message}`);
  if (!matches?.length) return [];

  const ids = (matches as { sample_id: string; score: number }[]).map(
    (m) => m.sample_id,
  );

  const [{ data: samples }, { data: vibeRows }, { data: descRows }] =
    await Promise.all([
      supabase
        .from("samples")
        .select("id, title, family, category, duration_sec, mp3_blob_url")
        .in("id", ids),
      supabase.from("sample_vibes").select("sample_id, vibe").in("sample_id", ids),
      supabase
        .from("sample_descriptions")
        .select("sample_id, text")
        .in("sample_id", ids)
        .eq("is_canonical", true)
        .is("deleted_at", null),
    ]);

  const sampleById = new Map((samples ?? []).map((s) => [s.id, s]));
  const vibesById = new Map<string, string[]>();
  for (const row of vibeRows ?? []) {
    const list = vibesById.get(row.sample_id) ?? [];
    list.push(row.vibe);
    vibesById.set(row.sample_id, list);
  }
  const descById = new Map((descRows ?? []).map((d) => [d.sample_id, d.text]));

  const results: SemanticResult[] = [];
  for (const m of matches as { sample_id: string; score: number }[]) {
    const s = sampleById.get(m.sample_id);
    if (!s) continue;
    results.push({
      sampleId: m.sample_id,
      score: m.score,
      rank: results.length,
      title: s.title ?? null,
      family: s.family ?? null,
      category: s.category ?? null,
      durationSec: s.duration_sec,
      mp3BlobUrl: s.mp3_blob_url ?? null,
      vibes: vibesById.get(m.sample_id) ?? [],
      description: descById.get(m.sample_id) ?? null,
    });
    if (results.length >= limit) break;
  }
  return results;
}
