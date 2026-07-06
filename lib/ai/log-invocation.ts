import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Raw model I/O logging — every AI feature writes its prompts + completions
 * to ai_invocations so eval suites, regression tests, and fine-tune corpora
 * come for free later. Fire-and-forget: never throws into the caller.
 */

export interface AiInvocationLog {
  userId?: string | null;
  feature: "search" | "describe" | "kit-builder" | "transcribe-cleanup";
  provider: string;
  model: string;
  request: Record<string, unknown>;
  response?: unknown;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

export async function logAiInvocation(entry: AiInvocationLog): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("ai_invocations").insert({
      user_id: entry.userId ?? null,
      feature: entry.feature,
      provider: entry.provider,
      model: entry.model,
      request_jsonb: entry.request,
      response_jsonb: entry.response ?? null,
      latency_ms: entry.latencyMs ?? null,
      input_tokens: entry.inputTokens ?? null,
      output_tokens: entry.outputTokens ?? null,
      error: entry.error ?? null,
    });
    if (error) console.error("logAiInvocation failed:", error.message);
  } catch (err) {
    console.error("logAiInvocation failed:", err);
  }
}

/**
 * Wrap an AI call with timing + logging. Returns the call's result; logs the
 * failure and rethrows on error so callers keep their own error handling.
 */
export async function withInvocationLog<T>(
  meta: Omit<AiInvocationLog, "response" | "latencyMs" | "error">,
  fn: () => Promise<{ result: T; response?: unknown; inputTokens?: number; outputTokens?: number }>,
): Promise<T> {
  const started = Date.now();
  try {
    const { result, response, inputTokens, outputTokens } = await fn();
    void logAiInvocation({
      ...meta,
      response,
      inputTokens: inputTokens ?? meta.inputTokens,
      outputTokens: outputTokens ?? meta.outputTokens,
      latencyMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    void logAiInvocation({
      ...meta,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
