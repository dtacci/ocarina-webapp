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

export async function getModel(task: "search" | "kit-builder" | "config-assist") {
  const provider = await getProvider();

  // Model selection per task — tuned for cost/quality balance
  const models = {
    anthropic: {
      search: anthropic("claude-sonnet-4-20250514"),
      "kit-builder": anthropic("claude-sonnet-4-20250514"),
      "config-assist": anthropic("claude-haiku-4-5-20251001"),
    },
    openai: {
      search: openai("gpt-4o-mini"),
      "kit-builder": openai("gpt-4o"),
      "config-assist": openai("gpt-4o-mini"),
    },
  };

  return models[provider][task];
}
