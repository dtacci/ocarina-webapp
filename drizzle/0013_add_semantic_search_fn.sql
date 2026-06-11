-- Semantic sample search RPC. Called via supabase.rpc() from server routes
-- (service-role client) — supabase-js can't express `ORDER BY embedding <=> $1`
-- directly. Cosine similarity over non-archived description embeddings.

CREATE OR REPLACE FUNCTION search_samples_semantic(
  query_embedding vector(1536),
  match_count int DEFAULT 40,
  filter_family text DEFAULT NULL
)
RETURNS TABLE (sample_id text, score real)
LANGUAGE sql STABLE AS $$
  SELECT se.sample_id, (1 - (se.embedding <=> query_embedding))::real AS score
  FROM sample_embeddings se
  JOIN samples s ON s.id = se.sample_id
  WHERE se.kind = 'description'
    AND se.archived = false
    AND se.embedding IS NOT NULL
    AND (filter_family IS NULL OR s.family::text = filter_family)
  ORDER BY se.embedding <=> query_embedding
  LIMIT LEAST(match_count, 200);
$$;
--> statement-breakpoint
-- Server-side only: routes call this with the service-role client.
REVOKE EXECUTE ON FUNCTION search_samples_semantic(vector, int, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION search_samples_semantic(vector, int, text) FROM anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION search_samples_semantic(vector, int, text) TO service_role;
--> statement-breakpoint
-- Pin search_path (security linter 0011).
ALTER FUNCTION search_samples_semantic(vector, int, text) SET search_path = public;
