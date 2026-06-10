// Shared fixture provisioning for the headless verify harnesses
// (verify-sample-editor.mjs, verify-dj-mode.mjs, …).
//
// Ensures a confirmed `verify-bot` user (password derived from the service
// key — nothing secret committed) and a generated 2-second WAV sample it owns
// (uploaded to Vercel Blob once, row id `se_verify_waveform`). Idempotent.
//
// Callers must load .env.local (dotenv) BEFORE importing helpers that read env.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";

export const VERIFY_EMAIL = "verify-bot@ocarina-webapp.dev";
export const VERIFY_SAMPLE_ID = "se_verify_waveform";
export const FIXTURE_DURATION = 2.0;
export const FIXTURE_SR = 48000;

export function verifyPassword() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from env");
  return createHash("sha256").update(`${serviceKey}:verify-bot`).digest("hex").slice(0, 24);
}

/** 2s mono PCM16 WAV: 440Hz burst, silence, 880Hz burst, silence. */
export function makeFixtureWav() {
  const n = Math.round(FIXTURE_DURATION * FIXTURE_SR);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / FIXTURE_SR;
    if (t < 0.5) samples[i] = 0.8 * Math.sin(2 * Math.PI * 440 * t) * Math.min(1, (0.5 - t) / 0.05, t / 0.01);
    else if (t >= 1.0 && t < 1.5) samples[i] = 0.6 * Math.sin(2 * Math.PI * 880 * t) * Math.min(1, (1.5 - t) / 0.05, (t - 1.0) / 0.01);
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(FIXTURE_SR, 24); buf.writeUInt32LE(FIXTURE_SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  const peaks = [];
  const bucket = Math.floor(n / 200);
  for (let b = 0; b < 200; b++) {
    let max = 0;
    for (let i = b * bucket; i < (b + 1) * bucket; i++) max = Math.max(max, Math.abs(samples[i]));
    peaks.push(Number(max.toFixed(4)));
  }
  return { buf, peaks };
}

/** Ensure verify-bot user + fixture sample exist; sanity-check RLS visibility. */
export async function ensureVerifyFixture() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const password = verifyPassword();
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  let user = list?.users.find((u) => u.email?.toLowerCase() === VERIFY_EMAIL);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: VERIFY_EMAIL, password, email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    user = data.user;
  }

  const { data: existing } = await admin.from("samples")
    .select("id,user_id").eq("id", VERIFY_SAMPLE_ID).maybeSingle();
  if (!existing || existing.user_id !== user.id) {
    if (existing) await admin.from("samples").delete().eq("id", VERIFY_SAMPLE_ID);
    const { buf, peaks } = makeFixtureWav();
    const blob = await put(`verify/${VERIFY_SAMPLE_ID}.wav`, buf, {
      access: "public", contentType: "audio/wav", addRandomSuffix: true,
    });
    const { error } = await admin.from("samples").insert({
      id: VERIFY_SAMPLE_ID, user_id: user.id, is_system: false, verified: false,
      title: null, blob_url: blob.url, mp3_blob_url: null,
      duration_sec: FIXTURE_DURATION, sample_rate: FIXTURE_SR, waveform_peaks: peaks,
      loopable: false, source_sample_id: null, edit_spec: null,
    });
    if (error) throw new Error(`insert sample: ${error.message}`);
    console.log(`provisioned sample ${VERIFY_SAMPLE_ID} → ${blob.url.slice(0, 60)}…`);
  }

  // Keep the title null: a non-empty title pre-fills editor metadata and
  // makes the sample editor's dirty-flag checks vacuous.
  await admin.from("samples").update({ title: null }).eq("id", VERIFY_SAMPLE_ID);

  // RLS sanity: can verify-bot actually read its row?
  const asBot = createClient(
    supaUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { error: loginErr } = await asBot.auth.signInWithPassword({
    email: VERIFY_EMAIL, password,
  });
  if (loginErr) throw new Error(`verify-bot login: ${loginErr.message}`);
  const { data: visible } = await asBot.from("samples")
    .select("id").eq("id", VERIFY_SAMPLE_ID).maybeSingle();
  if (!visible) throw new Error("RLS check failed: verify-bot can't read its own sample");
}

/**
 * Ensure a 2-stem looper session owned by verify-bot (for the track mixer):
 * parent "master" recording + two stems with distinct generated tones.
 * Returns { sessionId, stemIds }. Idempotent by parent title.
 */
export const VERIFY_SESSION_TITLE = "verify-bot session";

export async function ensureVerifySession() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const PARENT_TITLE = VERIFY_SESSION_TITLE;

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const user = list?.users.find((u) => u.email?.toLowerCase() === VERIFY_EMAIL);
  if (!user) throw new Error("run ensureVerifyFixture first");

  // recordings.session_id references public.sessions — find/create the play
  // session via the existing master recording's title.
  const { data: existing } = await admin.from("recordings")
    .select("id,session_id").eq("user_id", user.id).eq("title", PARENT_TITLE)
    .eq("recording_type", "master").maybeSingle();
  if (existing?.session_id) {
    const { data: stems } = await admin.from("recordings")
      .select("id").eq("session_id", existing.session_id).eq("recording_type", "stem")
      .order("created_at", { ascending: true });
    if (stems?.length === 2) {
      return { sessionId: existing.session_id, stemIds: stems.map((s) => s.id) };
    }
    await admin.from("recordings").delete().eq("session_id", existing.session_id);
  } else if (existing) {
    await admin.from("recordings").delete().eq("id", existing.id);
  }

  const { data: session, error: sErr } = await admin.from("sessions")
    .insert({ user_id: user.id, ended_at: new Date().toISOString(), duration_sec: FIXTURE_DURATION })
    .select("id").single();
  if (sErr) throw new Error(`insert session: ${sErr.message}`);

  // Stem A: the standard fixture (440/880 bursts). Stem B: continuous 660 Hz.
  const a = makeFixtureWav();
  const n = Math.round(FIXTURE_DURATION * FIXTURE_SR);
  const bSamples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / FIXTURE_SR;
    bSamples[i] = 0.5 * Math.sin(2 * Math.PI * 660 * t) * Math.min(1, t / 0.01, (FIXTURE_DURATION - t) / 0.05);
  }
  const bBuf = Buffer.from(a.buf); // clone header, rewrite data
  for (let i = 0; i < n; i++) {
    bBuf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bSamples[i])) * 32767), 44 + i * 2);
  }

  const [blobA, blobB] = await Promise.all([
    put("verify/session-stem-a.wav", a.buf, { access: "public", contentType: "audio/wav", addRandomSuffix: true }),
    put("verify/session-stem-b.wav", bBuf, { access: "public", contentType: "audio/wav", addRandomSuffix: true }),
  ]);

  const { error: pErr } = await admin.from("recordings").insert({
    user_id: user.id, title: PARENT_TITLE, blob_url: blobA.url,
    duration_sec: FIXTURE_DURATION, sample_rate: FIXTURE_SR, bpm: 120,
    recording_type: "master", waveform_peaks: a.peaks, session_id: session.id,
  });
  if (pErr) throw new Error(`insert parent: ${pErr.message}`);

  const stems = [];
  for (const [title, url] of [["Stem A (bursts)", blobA.url], ["Stem B (drone)", blobB.url]]) {
    const { data, error } = await admin.from("recordings").insert({
      user_id: user.id, title, blob_url: url,
      duration_sec: FIXTURE_DURATION, sample_rate: FIXTURE_SR, bpm: 120,
      recording_type: "stem", session_id: session.id,
    }).select("id").single();
    if (error) throw new Error(`insert stem: ${error.message}`);
    stems.push(data.id);
  }
  console.log(`provisioned session ${session.id} with 2 stems`);
  return { sessionId: session.id, stemIds: stems };
}

/** Drive the real /login form. Page must be a fresh Playwright page. */
export async function loginAsVerifyBot(page, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Email" }).fill(VERIFY_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(verifyPassword());
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}
