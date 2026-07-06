import { generateObject } from "ai";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getRecordingById } from "@/lib/db/queries/recordings";
import {
  getTranscriptionEvents,
  getDefaultRender,
} from "@/lib/db/queries/transcription";
import { getModel, getProvider } from "@/lib/ai/provider";
import { logAiInvocation } from "@/lib/ai/log-invocation";
import { logInteraction } from "@/lib/events/log";
import type { DeriveParams, OcarinaEvent } from "@/lib/transcription/types";

export const maxDuration = 60;

/**
 * AI cleanup for a transcription session: Claude reviews event-stream summary
 * stats + the current interpretation params + any "this looks wrong" feedback
 * and proposes an adjusted DeriveParams with a human-readable explanation.
 *
 * The client applies an accepted proposal through the existing derivation +
 * render-cache path (params-hash keyed), then reports the outcome to
 * /api/events as cleanup_accepted / cleanup_rejected — those labels are
 * training data for a future tuned cleanup model (docs/EVENTS.md).
 */

const proposalSchema = z.object({
  params: z.object({
    tempo_bpm: z.number().min(30).max(300),
    time_signature: z.tuple([z.number().int().min(1).max(16), z.number().int().min(1).max(16)]),
    key_signature: z
      .string()
      .describe('Key name like "C major" / "F# minor", or "auto" to detect'),
    quantize_grid: z.enum(["1/4", "1/8", "1/16", "1/8t", "1/16t"]),
    snap_threshold: z.number().min(0.1).max(1),
    min_note_ms: z.number().int().min(10).max(500),
    rests_vs_ties: z.enum(["rests", "ties"]),
    transpose: z.number().int().min(-24).max(24),
  }),
  explanation: z
    .string()
    .describe(
      "2-4 sentences, plain language, telling the musician what you changed and why (e.g. 'merged 14 spurious 30ms notes; try min_note_ms=80')",
    ),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("How confident you are this improves the transcription"),
});

const SYSTEM = `You are a music-transcription engineer reviewing a voice-performed recording session from the Digital Ocarina (a hum-to-instrument synthesizer). The performance was captured as note events from a pitch detector and rendered to sheet music with interpretation parameters.

You receive summary statistics of the raw event stream, the current parameters, and optionally the user's complaints. Propose adjusted parameters that would produce cleaner, more faithful notation.

Heuristics:
- Many very short notes (< 80ms) are usually pitch-detector flutter, not intentional — raise min_note_ms to absorb them.
- If inter-onset intervals cluster around a beat period, the tempo should match it (60000 / median IOI ≈ BPM, or a simple ratio of it).
- Low-confidence notes near semitone boundaries suggest the singer was between pitches — a coarser quantize grid or higher snap_threshold reads better.
- Consistent octave errors (notes far outside vocal range) suggest a transpose fix in whole octaves (±12).
- Only change what the evidence supports; keep everything else at its current value. Explain in musician language, not parameter names alone.`;

interface EventStats {
  noteCount: number;
  durationStats: { medianMs: number; under50ms: number; under80ms: number };
  confidenceStats: { median: number; under60pct: number };
  interOnsetMedianMs: number | null;
  midiRange: { min: number; max: number } | null;
  sessionLengthMs: number;
}

function computeStats(events: OcarinaEvent[]): EventStats {
  const noteOns = events.filter((e) => e.type === "note_on");
  const noteOffs = new Map<string, number[]>();
  for (const e of events) {
    if (e.type === "note_off") {
      const list = noteOffs.get(String(e.midi)) ?? [];
      list.push(e.t_ms);
      noteOffs.set(String(e.midi), list);
    }
  }

  const durations: number[] = [];
  for (const on of noteOns) {
    const offs = noteOffs.get(String(on.midi)) ?? [];
    const off = offs.find((t) => t > on.t_ms);
    if (off !== undefined) durations.push(off - on.t_ms);
  }

  const onsets = noteOns.map((e) => e.t_ms).sort((a, b) => a - b);
  const iois: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const gap = onsets[i] - onsets[i - 1];
    if (gap > 50 && gap < 3000) iois.push(gap);
  }

  const median = (xs: number[]) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const confs = noteOns.map((e) => e.conf).filter((c) => c != null);
  const midis = noteOns.map((e) => e.midi);
  const lastT = events.length ? Math.max(...events.map((e) => ("t_ms" in e ? e.t_ms : 0))) : 0;

  return {
    noteCount: noteOns.length,
    durationStats: {
      medianMs: Math.round(median(durations)),
      under50ms: durations.filter((d) => d < 50).length,
      under80ms: durations.filter((d) => d < 80).length,
    },
    confidenceStats: {
      median: Number(median(confs).toFixed(2)),
      under60pct: confs.filter((c) => c < 0.6).length,
    },
    interOnsetMedianMs: iois.length ? Math.round(median(iois)) : null,
    midiRange: midis.length ? { min: Math.min(...midis), max: Math.max(...midis) } : null,
    sessionLengthMs: lastT,
  };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const recording = await getRecordingById(id, user.id);
  if (!recording) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [eventsRow, defaultRender, { data: feedback }] = await Promise.all([
    getTranscriptionEvents(id),
    getDefaultRender(id),
    supabase
      .from("transcription_feedback")
      .select("message, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (!eventsRow) {
    return Response.json({ error: "No events for session" }, { status: 404 });
  }

  const currentParams = (defaultRender?.params_jsonb ?? null) as DeriveParams | null;
  const stats = computeStats(eventsRow.events_jsonb as OcarinaEvent[]);

  const prompt = [
    `Event-stream summary:\n${JSON.stringify(stats, null, 2)}`,
    `Current interpretation params:\n${JSON.stringify(currentParams, null, 2)}`,
    feedback?.length
      ? `User feedback ("this looks wrong" reports):\n${feedback
          .map((f) => `- ${f.message}`)
          .join("\n")}`
      : "No user feedback for this session.",
  ].join("\n\n");

  const provider = await getProvider();
  const model = await getModel("transcribe-cleanup");
  const started = Date.now();

  let result;
  try {
    result = await generateObject({
      model,
      schema: proposalSchema,
      system: SYSTEM,
      prompt,
    });
  } catch (err) {
    void logAiInvocation({
      userId: user.id,
      feature: "transcribe-cleanup",
      provider,
      model: model.modelId,
      request: { sessionId: id, stats },
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Cleanup failed" }, { status: 502 });
  }

  void logAiInvocation({
    userId: user.id,
    feature: "transcribe-cleanup",
    provider,
    model: model.modelId,
    request: { sessionId: id, stats, feedbackCount: feedback?.length ?? 0 },
    response: result.object,
    latencyMs: Date.now() - started,
    inputTokens: result.usage?.inputTokens,
    outputTokens: result.usage?.outputTokens,
  });

  void logInteraction(
    { userId: user.id, source: "web" },
    {
      eventType: "cleanup_proposed",
      sessionId: id,
      payload: {
        params_before: currentParams,
        params_after: result.object.params,
        explanation: result.object.explanation,
        confidence: result.object.confidence,
      },
    },
  );

  return Response.json(result.object);
}
