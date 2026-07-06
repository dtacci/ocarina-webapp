import { createHash } from "crypto";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

/**
 * Embedding utilities for semantic sample search.
 *
 * Text-embedding-first design: sample descriptions (Claude-generated, see
 * scripts/generate-descriptions.ts) are embedded with OpenAI
 * text-embedding-3-small into sample_embeddings (kind='description').
 * CLAP audio embeddings slot in later as kind='audio' — no schema change.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** Embeddings need an OpenAI key regardless of the chat-model provider. */
export function embeddingsAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const ATTR_ADJECTIVES: Record<string, [string, string]> = {
  // attribute: [low adjective (1-3), high adjective (8-10)]
  brightness: ["dark", "bright"],
  warmth: ["cold", "warm"],
  attack: ["slow-attack", "sharp-attack"],
  sustain: ["short", "sustained"],
  texture: ["smooth", "textured"],
};

export interface EmbeddableSample {
  id: string;
  title?: string | null;
  family?: string | null;
  category?: string | null;
  rootNote?: string | null;
  durationSec?: number | null;
  vibes?: string[];
  brightness?: number | null;
  warmth?: number | null;
  attack?: number | null;
  sustain?: number | null;
  texture?: number | null;
}

/**
 * Composite text fed to the embedding model: description + structured
 * metadata rendered as prose-ish tokens. Shared by the backfill script and
 * any single-sample re-embed so the hash stays stable.
 */
export function compositeText(sample: EmbeddableSample, description: string): string {
  const parts = [description.trim()];

  if (sample.vibes?.length) parts.push(`Vibes: ${sample.vibes.join(", ")}.`);
  if (sample.family) parts.push(`Family: ${sample.family}.`);

  const adjectives: string[] = [];
  for (const [attr, [low, high]] of Object.entries(ATTR_ADJECTIVES)) {
    const value = sample[attr as keyof EmbeddableSample] as number | null | undefined;
    if (value == null) continue;
    if (value <= 3) adjectives.push(low);
    else if (value >= 8) adjectives.push(high);
  }
  if (adjectives.length) parts.push(`Character: ${adjectives.join(", ")}.`);

  return parts.join(" ");
}
