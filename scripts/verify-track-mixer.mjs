// E2E verification for the track editor mix phase (/tracks/[sessionId]):
// stems decode + phase-locked playback, channel mute/solo audibly silence
// channels (analyser RMS via the dev-only window handle), the mix document
// persists across reload, and "export mixdown" produces a real non-silent
// recording row.
//
// Setup (one-time): npx playwright install chromium-headless-shell
// Usage (dev server must be running):
//   npm run verify:tracks [-- <base-url>]
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

config({ path: ".env.local", quiet: true });

const { ensureVerifyFixture, ensureVerifySession, loginAsVerifyBot, VERIFY_SESSION_TITLE } =
  await import("./lib/verify-fixture.mjs");

const BASE = process.argv[2] ?? "http://localhost:3000";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

await ensureVerifyFixture();
const { sessionId, stemIds } = await ensureVerifySession();

// Start every run from a clean slate: no saved mix, no prior mixdowns.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
await admin.from("session_mixes").delete().eq("session_id", sessionId);
// Clear prior mixdowns but keep the fixture parent master row.
await admin.from("recordings").delete().eq("session_id", sessionId)
  .eq("recording_type", "master").neq("title", VERIFY_SESSION_TITLE);

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await loginAsVerifyBot(page, BASE);
await page.goto(`${BASE}/tracks/${sessionId}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__mixEngine, { timeout: 30000 });

// ---- 1. Both stems render as channel strips ----
const stripA = page.getByText("Stem A (bursts)");
const stripB = page.getByText("Stem B (drone)");
check("both stems render as channel strips", (await stripA.count()) > 0 && (await stripB.count()) > 0);

// ---- 2. Play: phase-locked start, master audible ----
await page.getByRole("button", { name: "play session" }).click();
await page.waitForTimeout(700);

const rms = (id) =>
  page.evaluate(async (recId) => {
    const e = window.__mixEngine;
    const an = recId ? e.channelAnalyser(recId) : e.masterAnalyser;
    let acc = 0;
    for (let i = 0; i < 8; i++) {
      const v = an.getValue();
      let sum = 0;
      for (let j = 0; j < v.length; j++) sum += v[j] * v[j];
      acc += Math.sqrt(sum / v.length);
      await new Promise((r) => setTimeout(r, 90));
    }
    return acc / 8;
  }, id);

const masterRms = await rms(null);
check("session plays (master bus audible)", masterRms > 0.01, `master rms=${masterRms.toFixed(4)}`);

// ---- 3. Mute channel B → its analyser goes silent, A stays audible ----
const chanB = page.getByRole("group", { name: "channel Stem B (drone)" });
const chanA = page.getByRole("group", { name: "channel Stem A (bursts)" });
await chanB.getByRole("button", { name: "mute" }).click();
await page.waitForTimeout(300);
const [aAfterMute, bAfterMute] = [await rms(stemIds[0]), await rms(stemIds[1])];
check(
  "muting channel B silences only B",
  aAfterMute > 0.005 && bAfterMute < 0.002,
  `a=${aAfterMute.toFixed(4)} b=${bAfterMute.toFixed(4)}`,
);

// Unmute B, then solo A → B silent again via the solo matrix.
await chanB.getByRole("button", { name: "mute" }).click();
await chanA.getByRole("button", { name: "solo" }).click();
await page.waitForTimeout(300);
const bAfterSolo = await rms(stemIds[1]);
check("soloing channel A silences B", bAfterSolo < 0.002, `b=${bAfterSolo.toFixed(4)}`);

// ---- 4. Persistence: tweak, save, reload, assert ----
// Leave solo on A and drop A's level to 50%, then save.
const levelSlider = page.getByRole("slider").first(); // first strip's level (hidden native input)
await levelSlider.fill("0.5");
await page.getByRole("button", { name: "save mix" }).click();
await page.getByText("mix saved").waitFor({ timeout: 15000 });

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__mixEngine, { timeout: 30000 });
const persisted = await page.evaluate(() => {
  const sliders = [...document.querySelectorAll('input[type="range"]')];
  return sliders.map((s) => s.value);
});
const soloPersisted = await page
  .locator('button[aria-pressed="true"]')
  .filter({ hasText: "solo" })
  .count();
check(
  "mix persists across reload (volume + solo)",
  persisted.includes("0.5") && soloPersisted === 1,
  `sliders=${persisted.join(",")} solo=${soloPersisted}`,
);

// ---- 5. Export mixdown → non-silent master recording appears ----
await page.getByRole("button", { name: "export mixdown" }).click();
await page.getByText("mixdown saved to recordings").waitFor({ timeout: 60000 });
const { data: masters } = await admin
  .from("recordings")
  .select("id,blob_url,duration_sec")
  .eq("session_id", sessionId)
  .eq("recording_type", "master")
  .neq("title", VERIFY_SESSION_TITLE); // the fixture parent is a master too
check("mixdown row created", masters?.length === 1, `rows=${masters?.length}`);
let peak = 0;
if (masters?.[0]) {
  const wav = Buffer.from(await (await fetch(masters[0].blob_url)).arrayBuffer());
  for (let i = 44; i < wav.length - 1; i += 2) {
    peak = Math.max(peak, Math.abs(wav.readInt16LE(i)) / 32768);
  }
}
check("mixdown audio is non-silent", peak > 0.05, `peak=${peak.toFixed(3)}`);

// ---- 6. Console hygiene ----
const realErrors = errors.filter((e) => !/manifest|favicon/i.test(e));
check("no page errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | ") || "clean");

await page.screenshot({ path: "/tmp/track-mixer-verified.png" });
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
