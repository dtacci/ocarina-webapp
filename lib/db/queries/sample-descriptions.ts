import { createAdminClient } from "@/lib/supabase/admin";
import {
  compositeText,
  contentHash,
  embedText,
  embeddingsAvailable,
  EMBEDDING_MODEL,
  type EmbeddableSample,
} from "@/lib/ai/embedding";

export interface SampleDescription {
  id: string;
  sampleId: string;
  text: string;
  source: string; // 'llm:<model>' | 'human'
  parentDescriptionId: string | null;
  createdAt: string;
}

export async function getCanonicalDescription(
  sampleId: string,
): Promise<SampleDescription | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sample_descriptions")
    .select("id, sample_id, text, source, parent_description_id, created_at")
    .eq("sample_id", sampleId)
    .eq("is_canonical", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    sampleId: data.sample_id,
    text: data.text,
    source: data.source,
    parentDescriptionId: data.parent_description_id,
    createdAt: data.created_at,
  };
}

/**
 * Human revision of a sample description. The previous canonical row becomes
 * the parent (LLM-proposed → human-edited chains are future fine-tune pairs),
 * the new row takes the canonical flag, and the embedding is refreshed.
 * Returns the new description id.
 */
export async function reviseDescription(
  sampleId: string,
  text: string,
  userId: string,
): Promise<{ id: string; parentId: string | null }> {
  const supabase = createAdminClient();
  const current = await getCanonicalDescription(sampleId);

  // Demote the old canonical first — the partial unique index allows only
  // one canonical, non-deleted row per sample.
  if (current) {
    const { error } = await supabase
      .from("sample_descriptions")
      .update({ is_canonical: false })
      .eq("id", current.id);
    if (error) throw new Error(`demote canonical failed: ${error.message}`);
  }

  const { data, error } = await supabase
    .from("sample_descriptions")
    .insert({
      sample_id: sampleId,
      text,
      source: "human",
      parent_description_id: current?.id ?? null,
      is_canonical: true,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`insert description failed: ${error?.message}`);
  }

  // Refresh the embedding (idempotent on content_hash). Non-fatal: search
  // serves the stale vector until the next embed run if this fails.
  try {
    await reembedSample(sampleId, text);
  } catch (err) {
    console.error(`re-embed failed for ${sampleId}:`, err);
  }

  return { id: data.id, parentId: current?.id ?? null };
}

async function reembedSample(sampleId: string, description: string): Promise<void> {
  if (!embeddingsAvailable()) return;
  const supabase = createAdminClient();

  const [{ data: sample }, { data: vibeRows }] = await Promise.all([
    supabase
      .from("samples")
      .select("id, title, family, category, root_note, duration_sec, brightness, warmth, attack, sustain, texture")
      .eq("id", sampleId)
      .single(),
    supabase.from("sample_vibes").select("vibe").eq("sample_id", sampleId),
  ]);
  if (!sample) return;

  const embeddable: EmbeddableSample = {
    id: sample.id,
    title: sample.title,
    family: sample.family,
    category: sample.category,
    rootNote: sample.root_note,
    durationSec: sample.duration_sec,
    vibes: (vibeRows ?? []).map((v) => v.vibe),
    brightness: sample.brightness,
    warmth: sample.warmth,
    attack: sample.attack,
    sustain: sample.sustain,
    texture: sample.texture,
  };

  const text = compositeText(embeddable, description);
  const hash = contentHash(text);

  const { data: existing } = await supabase
    .from("sample_embeddings")
    .select("content_hash")
    .eq("sample_id", sampleId)
    .eq("kind", "description")
    .eq("model", EMBEDDING_MODEL)
    .maybeSingle();
  if (existing?.content_hash === hash) return;

  const embedding = await embedText(text);
  const { error } = await supabase.from("sample_embeddings").upsert(
    {
      sample_id: sampleId,
      kind: "description",
      model: EMBEDDING_MODEL,
      content_hash: hash,
      embedding: JSON.stringify(embedding),
      archived: false,
    },
    { onConflict: "sample_id,kind,model" },
  );
  if (error) throw new Error(`embedding upsert failed: ${error.message}`);
}
