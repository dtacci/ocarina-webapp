import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { cookies } from "next/headers";

/**
 * AI provider abstraction — defaults to Anthropic, switchable to OpenAI.
 * User can toggle via cookie (set by /api/ai/provider), or fallback to env var.
 */
export type AIProvider = "anthropic" | "openai";

export async function getProvider(): Promise<AIProvider> {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get("ai_provider")?.value;
    if (cookieVal === "anthropic" || cookieVal === "openai") return cookieVal;
  } catch {
    // Called outside request context
  }
  return (process.env.AI_PROVIDER as AIProvider) || "anthropic";
}

export type AITask =
  | "search"
  | "kit-builder"
  | "config-assist"
  | "describe"
  | "transcribe-cleanup";

export async function getModel(task: AITask) {
  const provider = await getProvider();

  // Model selection per task — tuned for cost/quality balance
  const models = {
    anthropic: {
      search: anthropic("claude-sonnet-4-6"),
      "kit-builder": anthropic("claude-sonnet-4-6"),
      "config-assist": anthropic("claude-haiku-4-5"),
      describe: anthropic("claude-haiku-4-5"),
      "transcribe-cleanup": anthropic("claude-sonnet-4-6"),
    },
    openai: {
      search: openai("gpt-4o-mini"),
      "kit-builder": openai("gpt-4o"),
      "config-assist": openai("gpt-4o-mini"),
      describe: openai("gpt-4o-mini"),
      "transcribe-cleanup": openai("gpt-4o"),
    },
  };

  return models[provider][task];
}
