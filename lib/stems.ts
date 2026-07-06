/**
 * Stem separation via Replicate (hosted Demucs) for the optional "deep analyze"
 * path. Pay-per-use, no GPU to manage; the prediction API is async so we submit
 * then poll. Entirely config-gated — when REPLICATE_API_TOKEN / model aren't set
 * the feature degrades to "not available" rather than erroring the fast path.
 *
 * REPLICATE_DEMUCS_MODEL is a version hash (or 'owner/name:version'); output
 * shape varies by model, so stem mapping is matched by name defensively.
 */

const REPLICATE_API = "https://api.replicate.com/v1";
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 110_000;

export interface Stems {
  vocals: string | null;
  drums: string | null;
  bass: string | null;
  other: string | null;
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string;
  urls?: { get?: string };
}

export function stemSeparationAvailable(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_DEMUCS_MODEL);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractVersion(model: string): string {
  return model.includes(":") ? (model.split(":").pop() as string) : model;
}

function mapStems(output: unknown): Stems {
  const stems: Stems = { vocals: null, drums: null, bass: null, other: null };
  if (output && typeof output === "object" && !Array.isArray(output)) {
    for (const [key, val] of Object.entries(output as Record<string, unknown>)) {
      if (typeof val !== "string") continue;
      const k = key.toLowerCase();
      if (k.includes("vocal")) stems.vocals = val;
      else if (k.includes("drum")) stems.drums = val;
      else if (k.includes("bass")) stems.bass = val;
      else if (k.includes("other") || k.includes("accompan")) stems.other = val;
    }
  }
  return stems;
}

export async function separateStems(audioUrl: string): Promise<Stems> {
  const token = process.env.REPLICATE_API_TOKEN as string;
  const version = extractVersion(process.env.REPLICATE_DEMUCS_MODEL as string);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const createRes = await fetch(`${REPLICATE_API}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ version, input: { audio: audioUrl } }),
  });
  if (!createRes.ok) throw new Error(`Replicate create failed: ${createRes.status}`);
  let pred = (await createRes.json()) as ReplicatePrediction;

  const start = Date.now();
  while (pred.status === "starting" || pred.status === "processing") {
    if (Date.now() - start > MAX_POLL_MS) throw new Error("Stem separation timed out");
    await sleep(POLL_INTERVAL_MS);
    const getUrl = pred.urls?.get ?? `${REPLICATE_API}/predictions/${pred.id}`;
    const pollRes = await fetch(getUrl, { headers });
    if (!pollRes.ok) throw new Error(`Replicate poll failed: ${pollRes.status}`);
    pred = (await pollRes.json()) as ReplicatePrediction;
  }

  if (pred.status !== "succeeded") {
    throw new Error(`Stem separation ${pred.status}: ${pred.error ?? "unknown"}`);
  }
  return mapStems(pred.output);
}
