import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

/**
 * AI provider abstraction — defaults to Anthropic, switchable to OpenAI.
 * Set AI_PROVIDER=openai in .env.local to switch.
 */
export type AIProvider = "anthropic" | "openai";

export function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) || "anthropic";
}

export function getModel(task: "search" | "kit-builder" | "config-assist") {
  const provider = getProvider();

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
