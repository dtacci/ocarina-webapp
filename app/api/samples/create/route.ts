import { createClient } from "@/lib/supabase/server";
import { put } from "@vercel/blob";

export const maxDuration = 60;

/**
 * Sample Editor — "save as new" endpoint.
 *
 * Receives a fully rendered WAV (the client has already run Tone.Offline +
 * encoded PCM16) along with metadata + the editSpec for round-trip.
 *
 * Body: multipart/form-data
 *   - wav:            Blob         (audio/wav)
 *   - metadata:       JSON string  (see MetadataPayload below)
 *   - editSpec:       JSON string  (the EffectNode[] chain)
 *   - sourceSampleId: string       (lineage — the sample this was edited from)
 *
 * Returns: { id: string }
 */
interface MetadataPayload {
  name?: string | null;
  family?: string | null;
  category?: string | null;
  rootNote?: string | null;
  rootFreq?: number | null;
  brightness?: number | null;
  attack?: number | null;
  sustain?: number | null;
  texture?: number | null;
  warmth?: number | null;
  vibes?: string[];
  waveformPeaks: number[];
  durationSec: number;
  sampleRate: number;
}

function slugify(input: string, fallback = "sample"): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || fallback;
}

function generateSampleId(): string {
  return `se_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const wav = formData.get("wav");
  const metadataStr = formData.get("metadata");
  const editSpecStr = formData.get("editSpec");
  const sourceSampleId = formData.get("sourceSampleId");

  if (!(wav instanceof Blob)) {
    return Response.json({ error: "Missing wav blob" }, { status: 400 });
  }
  if (typeof metadataStr !== "string") {
    return Response.json({ error: "Missing metadata" }, { status: 400 });
  }
  if (typeof editSpecStr !== "string") {
    return Response.json({ error: "Missing editSpec" }, { status: 400 });
  }
  if (typeof sourceSampleId !== "string" || !sourceSampleId) {
    return Response.json({ error: "Missing sourceSampleId" }, { status: 400 });
  }

  let metadata: MetadataPayload;
  let editSpec: unknown;
  try {
    metadata = JSON.parse(metadataStr);
    editSpec = JSON.parse(editSpecStr);
  } catch {
    return Response.json({ error: "Invalid JSON in metadata or editSpec" }, { status: 400 });
  }

  if (!Array.isArray(metadata.waveformPeaks) || typeof metadata.durationSec !== "number") {
    return Response.json({ error: "metadata.waveformPeaks and durationSec required" }, { status: 400 });
  }

  const sampleId = generateSampleId();
  const slug = slugify(metadata.name ?? metadata.family ?? "sample");
  const path = `${user.id}/samples/${Date.now()}-${slug}.wav`;

  const blob = await put(path, wav, {
    access: "public",
    contentType: "audio/wav",
    addRandomSuffix: true,
  });

  const { error } = await supabase.from("samples").insert({
    id: sampleId,
    user_id: user.id,
    is_system: false,
    verified: false,
    blob_url: blob.url,
    duration_sec: metadata.durationSec,
    sample_rate: metadata.sampleRate,
    waveform_peaks: metadata.waveformPeaks,
    root_note: metadata.rootNote ?? null,
    root_freq: metadata.rootFreq ?? null,
    brightness: metadata.brightness ?? null,
    attack: metadata.attack ?? null,
    sustain: metadata.sustain ?? null,
    texture: metadata.texture ?? null,
    warmth: metadata.warmth ?? null,
    category: metadata.category ?? null,
    family: metadata.family ?? null,
    loopable: false,
    source_sample_id: sourceSampleId,
    edit_spec: editSpec,
  });

  if (error) {
    return Response.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
  }

  // Vibes (if provided) — separate m2m table.
  if (Array.isArray(metadata.vibes) && metadata.vibes.length > 0) {
    const vibeRows = metadata.vibes
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.length > 0)
      .slice(0, 20)
      .map((v) => ({ sample_id: sampleId, vibe: v }));
    if (vibeRows.length > 0) {
      await supabase.from("sample_vibes").insert(vibeRows);
    }
  }

  return Response.json({ id: sampleId });
}
