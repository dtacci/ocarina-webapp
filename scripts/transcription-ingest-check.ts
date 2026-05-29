/**
 * End-to-end ingest verification (no dev server needed).
 *
 *   npx tsx scripts/transcription-ingest-check.ts [song]
 *
 * Loads .env.local, picks the first auth user as owner, runs the real
 * `ingestSession` pipeline (Blob upload + DB writes), then reads the rows back
 * and prints a summary. This writes real rows — it doubles as demo seeding.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { ingestSession } from "@/lib/transcription/ingest";
import { generateOcrec } from "@/lib/transcription/fake-events";
import { getSong } from "@/lib/transcription/songs";

const songName = process.argv[2] ?? "twinkle";

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error || !list.users.length) {
    console.error("No auth users found. Run scripts/create-dev-user.mjs first.", error?.message);
    process.exit(1);
  }
  const userId = list.users[0].id;
  console.log(`Owner user: ${list.users[0].email} (${userId})`);

  const song = getSong(songName)!;
  const jsonl = generateOcrec(song);

  const result = await ingestSession(jsonl, { userId, title: song.name });
  console.log("ingestSession →", result);

  const { data: rec } = await admin
    .from("recordings")
    .select("id, title, recording_type, transcription_status, event_count, duration_sec, blob_url")
    .eq("id", result.recordingId)
    .single();
  console.log("recordings row →", rec);

  const { data: render } = await admin
    .from("transcription_renders")
    .select("id, is_default, params_hash, parser_version, musicxml")
    .eq("session_id", result.recordingId)
    .single();
  console.log("default render →", {
    ...render,
    musicxml: render?.musicxml ? `${render.musicxml.length} chars` : null,
  });

  console.log(`\n✓ Visit /transcriptions/${result.recordingId} once the detail page ships (PR4).`);
}

main();
