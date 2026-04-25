import { createAdminClient } from "@/lib/supabase/admin";
import { put } from "@vercel/blob";
import { transcodeToMp3 } from "@/lib/audio/transcode-mp3";

export const maxDuration = 300;

/**
 * Admin-only batch backfill: transcode samples WAV → MP3.
 *
 * Processes up to `batchSize` (default 50) samples that have
 * `mp3_blob_url IS NULL`. Idempotent — safe to re-invoke until
 * `remaining` reaches 0. Each invocation is independent, so a crash
 * or timeout just means you re-run and it picks up where it left off.
 *
 * Auth: requires ADMIN_SECRET header to match the env var.
 * Invoke: curl -X POST -H "x-admin-secret: $ADMIN_SECRET" \
 *           https://your-app.vercel.app/api/admin/transcode-samples
 *
 * Query params:
 *   ?batch=50  — number of samples per invocation (default 50)
 *
 * Returns: { processed, failed, remaining, errors: string[] }
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const batchSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("batch")) || 50),
  );

  const supabase = createAdminClient();

  // Fetch the next batch of samples without an MP3.
  const { data: samples, error: fetchError } = await supabase
    .from("samples")
    .select("id, blob_url")
    .is("mp3_blob_url", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchError) {
    return Response.json(
      { error: `Query failed: ${fetchError.message}` },
      { status: 500 },
    );
  }

  if (!samples || samples.length === 0) {
    return Response.json({ processed: 0, failed: 0, remaining: 0, errors: [] });
  }

  // Count total remaining (including this batch) for progress reporting.
  const { count: totalRemaining } = await supabase
    .from("samples")
    .select("id", { count: "exact", head: true })
    .is("mp3_blob_url", null);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const sample of samples) {
    try {
      // 1. Download WAV from Vercel Blob
      const wavRes = await fetch(sample.blob_url);
      if (!wavRes.ok) {
        throw new Error(`WAV download failed: ${wavRes.status}`);
      }
      const wavBuffer = await wavRes.arrayBuffer();

      // 2. Transcode to MP3 (VBR V0)
      const mp3Buffer = await transcodeToMp3(wavBuffer);

      // 3. Upload MP3 to Vercel Blob
      const mp3Path = `system/samples/mp3/${sample.id}.mp3`;
      const mp3Blob = await put(mp3Path, mp3Buffer, {
        access: "public",
        contentType: "audio/mpeg",
        addRandomSuffix: false,
      });

      // 4. Update the sample row
      const { error: updateError } = await supabase
        .from("samples")
        .update({ mp3_blob_url: mp3Blob.url })
        .eq("id", sample.id);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }

      processed++;
    } catch (e) {
      failed++;
      const msg = `${sample.id}: ${e instanceof Error ? e.message : String(e)}`;
      errors.push(msg);
      console.error(`[transcode-samples] ${msg}`);
    }
  }

  return Response.json({
    processed,
    failed,
    remaining: (totalRemaining ?? 0) - processed,
    errors,
  });
}
