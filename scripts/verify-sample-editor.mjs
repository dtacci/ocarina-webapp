// E2E verification for the sample editor's waveform canvas: waveform painting,
// trim-handle dragging (readout + undo), click-to-seek playback (rAF playhead
// + timecode), and transport keyboard control.
//
// Like scripts/verify-notation-playback.mjs, this exists because the canvas
// renders client-side (WaveSurfer into a shadow DOM) and can't be unit-tested.
// Run it whenever waveform-canvas, editor, transport-bar, or tone-chain change.
//
// Self-provisioning: ensures a confirmed `verify-bot@ocarina-webapp.dev` user
// (password derived from SUPABASE_SERVICE_ROLE_KEY — nothing secret committed)
// and a 2-second generated WAV sample owned by it (uploaded to Vercel Blob
// once, row id `se_verify_waveform`). Reruns reuse both.
//
// Setup (one-time): npx playwright install chromium-headless-shell
// Usage (dev server must be running):
//   npm run verify:sample-editor [-- <base-url>]
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";
import { chromium } from "playwright";

config({ path: ".env.local", quiet: true });

const BASE = process.argv[2] ?? "http://localhost:3000";
const SAMPLE_ID = "se_verify_waveform";
const EMAIL = "verify-bot@ocarina-webapp.dev";
const DURATION = 2.0;
const SR = 48000;

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supaUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const PASSWORD = createHash("sha256").update(`${serviceKey}:verify-bot`).digest("hex").slice(0, 24);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// ─── phase 0: provision verify user + sample (service role) ────────────────

/** 2s mono PCM16 WAV: 440Hz burst, silence, 880Hz burst, silence. */
function makeWav() {
  const n = Math.round(DURATION * SR);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (t < 0.5) samples[i] = 0.8 * Math.sin(2 * Math.PI * 440 * t) * Math.min(1, (0.5 - t) / 0.05, t / 0.01);
    else if (t >= 1.0 && t < 1.5) samples[i] = 0.6 * Math.sin(2 * Math.PI * 880 * t) * Math.min(1, (1.5 - t) / 0.05, (t - 1.0) / 0.01);
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
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

async function provision() {
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // User
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  let user = list?.users.find((u) => u.email?.toLowerCase() === EMAIL);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    user = data.user;
  }

  // Sample (owned by verify-bot so RLS lets the browser session read it)
  const { data: existing } = await admin.from("samples")
    .select("id,user_id,blob_url").eq("id", SAMPLE_ID).maybeSingle();
  if (!existing || existing.user_id !== user.id) {
    if (existing) await admin.from("samples").delete().eq("id", SAMPLE_ID);
    const { buf, peaks } = makeWav();
    const blob = await put(`verify/${SAMPLE_ID}.wav`, buf, {
      access: "public", contentType: "audio/wav", addRandomSuffix: true,
    });
    const { error } = await admin.from("samples").insert({
      id: SAMPLE_ID, user_id: user.id, is_system: false, verified: false,
      title: "verify-bot waveform", blob_url: blob.url, mp3_blob_url: null,
      duration_sec: DURATION, sample_rate: SR, waveform_peaks: peaks,
      loopable: false, source_sample_id: null, edit_spec: null,
    });
    if (error) throw new Error(`insert sample: ${error.message}`);
    console.log(`provisioned sample ${SAMPLE_ID} → ${blob.url.slice(0, 60)}…`);
  }

  // Keep the title null: the editor pre-fills metadata.name from it, and a
  // non-empty name makes the "unsaved changes" dirty flag vacuously true.
  await admin.from("samples").update({ title: null }).eq("id", SAMPLE_ID);

  // RLS sanity: can verify-bot actually read its row?
  const asBot = createClient(
    supaUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { error: loginErr } = await asBot.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (loginErr) throw new Error(`verify-bot login: ${loginErr.message}`);
  const { data: visible } = await asBot.from("samples").select("id").eq("id", SAMPLE_ID).maybeSingle();
  if (!visible) throw new Error("RLS check failed: verify-bot can't read its own sample");
}

await provision();

// ─── phase 1: drive the editor ──────────────────────────────────────────────

const TIMECODE = /(\d+):(\d+\.\d+)/;
const parseTc = (text) => {
  const m = text?.match(TIMECODE);
  return m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) : NaN;
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
// Wide viewport: the workbench layout overflows 1400px and off-viewport
// coordinates are un-clickable (mouse events hit nothing there).
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// Login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByRole("textbox", { name: "Email" }).fill(EMAIL);
await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
await page.getByRole("button", { name: /sign in|log in/i }).first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

// Open the editor and wait for audio decode
await page.goto(`${BASE}/sample-editor/${SAMPLE_ID}`, { waitUntil: "domcontentloaded" });
await page.getByText("decoded", { exact: true }).waitFor({ timeout: 30000 });
await page.waitForTimeout(600);

const transportTc = () => page.locator('[aria-label="transport"] .workbench-readout').textContent().then(parseTc);
// The readout row above the waveform: "0:00.000 → 0:02.000  duration …"
const readoutBounds = async () => {
  const text = await page.locator("text=duration").locator("..").textContent();
  const ms = [...text.matchAll(/(\d+):(\d+\.\d+)/g)].map((m) => parseInt(m[1], 10) * 60 + parseFloat(m[2]));
  return { start: ms[0], end: ms[1] };
};

// ---- 1. Waveform canvas painted from peaks ----
const paint = await page.evaluate(() => {
  const all = [];
  const collect = (root) => {
    for (const c of root.querySelectorAll("canvas")) all.push(c);
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) collect(el.shadowRoot);
  };
  collect(document);
  const wave = all.filter((c) => c.height >= 100).sort((a, b) => b.width - a.width)[0];
  if (!wave) return { canvases: all.length, painted: 0 };
  const ctx = wave.getContext("2d");
  const data = ctx.getImageData(0, 0, wave.width, wave.height).data;
  let painted = 0;
  for (let i = 3; i < data.length; i += 40) if (data[i] > 0) painted++;
  return { canvases: all.length, painted, sampled: Math.floor(data.length / 40) };
});
check(
  "waveform canvas is painted (non-blank pixels)",
  paint.painted > paint.sampled * 0.01,
  `${paint.canvases} canvases, ${paint.painted}/${paint.sampled} sampled px inked`,
);

// ---- 2. Trim region handles exist, full-duration readout ----
const handles = await page.locator('[part*="region-handle"]').count();
const initial = await readoutBounds();
check("trim handles rendered", handles === 2, `${handles} handles`);
check(
  "initial trim spans the full sample",
  Math.abs(initial.start) < 0.02 && Math.abs(initial.end - DURATION) < 0.02,
  `${initial.start}s → ${initial.end}s`,
);

// ---- 3. Drag the right trim handle left → readout updates, dirty flag ----
const rightHandle = page.locator('[part*="region-handle-right"]');
await rightHandle.scrollIntoViewIfNeeded();
const hb = await rightHandle.boundingBox();
if (hb.x + hb.width / 2 > 1670) throw new Error(`right handle still off-viewport at x=${hb.x}`);
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
await page.mouse.down();
await page.mouse.move(hb.x - 200, hb.y + hb.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(400);
const afterDrag = await readoutBounds();
check(
  "dragging the right trim handle shortens the trim",
  afterDrag.end < initial.end - 0.3 && afterDrag.start === initial.start,
  `end ${initial.end}s → ${afterDrag.end}s`,
);
check(
  "trim edit marks the editor dirty",
  await page.getByText("unsaved changes").isVisible(),
);

// Browsers fire a synthetic click at the drag's common ancestor on mouseup;
// the canvas suppresses it after a trim commit so a handle drag must NOT
// start playback (regression check for the drag-release seek bug).
const playingAfterDrag = await page
  .getByRole("button", { name: "stop playback" }).isVisible().catch(() => false);
check("releasing a trim drag does not trigger seek-and-play", !playingAfterDrag);
if (playingAfterDrag) {
  await page.getByRole("button", { name: "stop playback" }).click();
  await page.waitForTimeout(200);
}

// ---- 4. Undo restores the trim ----
await page.keyboard.press("Control+z");
await page.waitForTimeout(300);
const afterUndo = await readoutBounds();
check(
  "ctrl+z restores the trim",
  Math.abs(afterUndo.end - initial.end) < 0.02,
  `end back to ${afterUndo.end}s`,
);
check(
  "undo clears the dirty flag",
  !(await page.getByText("unsaved changes").isVisible().catch(() => false)),
);

// ---- 5. Click-to-seek: click mid-waveform → playback from ~that position ----
const canvasBox = await page.locator('[part*="region-handle-left"]').evaluate((el) => {
  // The wave container is the region's positioned ancestor; use its rect.
  const host = el.getRootNode().host ?? el.closest("div");
  const r = (host?.parentElement ?? host).getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
const clickFrac = 0.5;
await page.mouse.click(canvasBox.x + canvasBox.width * clickFrac, canvasBox.y + canvasBox.height * 0.6);
await page.getByRole("button", { name: "stop playback" }).waitFor({ timeout: 10000 });
const t1 = await transportTc();
await page.waitForTimeout(500);
const t2 = await transportTc();
check(
  "click on waveform starts playback near the clicked time",
  t1 >= DURATION * clickFrac - 0.35 && t1 <= DURATION * clickFrac + 0.6,
  `clicked ~${(DURATION * clickFrac).toFixed(2)}s, playhead read ${t1.toFixed(3)}s`,
);
check("playhead timecode advances during playback", t2 > t1, `${t1.toFixed(3)}s → ${t2.toFixed(3)}s`);

// ---- 6. Space stops the transport ----
await page.keyboard.press("Space");
await page.waitForTimeout(300);
const stopped = await page.getByRole("button", { name: "start playback" }).isVisible();
const t3 = await transportTc();
await page.waitForTimeout(400);
const t4 = await transportTc();
check("space stops playback (timecode freezes)", stopped && t3 === t4, `frozen at ${t3.toFixed(3)}s`);

// ---- 7. Console hygiene ----
const realErrors = errors.filter((e) => !/manifest|favicon/i.test(e));
check("no page errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | ") || "clean");

await page.screenshot({ path: "/tmp/sample-editor-verified.png" });
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
