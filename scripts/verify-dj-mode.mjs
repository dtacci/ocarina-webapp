// E2E verification for DJ mode (/dj): deck loading from the source browser,
// playback, equal-power crossfader behavior (deck analyser levels invert),
// mid-sweep behavior, transport, hot-cue pads, the waveform overview
// (renders + click-to-seek), and the tempo fader.
//
// Loudness has no DOM proxy, so the page exposes the engine as
// `window.__djEngine` in development (see dj-surface.tsx) and this script
// reads the per-deck POST-crossfade analysers directly.
//
// Setup (one-time): npx playwright install chromium-headless-shell
// Usage (dev server must be running):
//   npm run verify:dj [-- <base-url>]
import { config } from "dotenv";
import { chromium } from "playwright";

config({ path: ".env.local", quiet: true });

const { ensureVerifyFixture, loginAsVerifyBot } = await import("./lib/verify-fixture.mjs");

const BASE = process.argv[2] ?? "http://localhost:3000";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

await ensureVerifyFixture();

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await loginAsVerifyBot(page, BASE);
await page.goto(`${BASE}/dj`, { waitUntil: "domcontentloaded" });

// Engine ready = both load buttons present + dev handle exposed.
await page.waitForFunction(() => !!window.__djEngine, { timeout: 30000 });

// ---- 1. Load the fixture sample into both decks via the source browser ----
const loadDeck = async (label) => {
  await page.getByRole("button", { name: "load" }).nth(label === "A" ? 0 : 1).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "samples" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /untitled sample/i }).first().click();
  // Browser closes; wait for the deck header to show the loaded title.
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page
    .locator(`section[aria-label="Deck ${label}"]`)
    .getByText(/untitled sample/i)
    .waitFor({ timeout: 20000 });
};
await loadDeck("A");
await loadDeck("B");
const decksLoaded = await page.evaluate(() => {
  const e = window.__djEngine;
  return e.decks.a.getState().loaded && e.decks.b.getState().loaded;
});
check("both decks load the fixture from the source browser", decksLoaded);

// ---- 2. Loop + play both decks ----
for (const label of ["A", "B"]) {
  const deck = page.locator(`section[aria-label="Deck ${label}"]`);
  await deck.getByRole("button", { name: "loop" }).click();
  await deck.getByRole("button", { name: `play deck ${label}` }).click();
}
await page.waitForTimeout(700);
const playing = await page.evaluate(() => {
  const e = window.__djEngine;
  return e.decks.a.getState().playing && e.decks.b.getState().playing;
});
check("both decks play (looped)", playing);

const positionAdvances = await page.evaluate(async () => {
  const e = window.__djEngine;
  const p1 = e.decks.a.getState().positionSec;
  await new Promise((r) => setTimeout(r, 400));
  return e.decks.a.getState().positionSec !== p1;
});
check("deck playhead advances", positionAdvances);

// ---- 3. Crossfader: post-crossfade deck levels invert across a sweep ----
// RMS over several analyser frames; the fixture has silence gaps, so sample
// for longer than a gap (≥600ms) to ensure we catch sounding sections.
const rmsAt = (x) =>
  page.evaluate(async (xf) => {
    const e = window.__djEngine;
    e.setCrossfade(xf, 0.03);
    await new Promise((r) => setTimeout(r, 250)); // let the ramp settle
    const acc = { a: 0, b: 0, n: 0 };
    for (let i = 0; i < 8; i++) {
      for (const d of ["a", "b"]) {
        const v = e.decks[d].analyser.getValue();
        let sum = 0;
        for (let j = 0; j < v.length; j++) sum += v[j] * v[j];
        acc[d] += Math.sqrt(sum / v.length);
      }
      acc.n++;
      await new Promise((r) => setTimeout(r, 90));
    }
    return { a: acc.a / acc.n, b: acc.b / acc.n };
  }, x);

const fullA = await rmsAt(0);
const center = await rmsAt(0.5);
const fullB = await rmsAt(1);
const fmt = (r) => `a=${r.a.toFixed(4)} b=${r.b.toFixed(4)}`;
check(
  "crossfade at 0 → deck A audible, deck B silent",
  fullA.a > 0.01 && fullA.b < fullA.a * 0.05,
  fmt(fullA),
);
check(
  "crossfade at 1 → levels invert",
  fullB.b > 0.01 && fullB.a < fullB.b * 0.05,
  fmt(fullB),
);
check(
  "crossfade at center → both decks audible",
  center.a > 0.005 && center.b > 0.005,
  fmt(center),
);

// ---- 4. On-screen crossfader slider drives the engine ----
await page.getByRole("slider", { name: "crossfader" }).fill("0.1");
const sliderXf = await page.evaluate(() => window.__djEngine.getCrossfade());
check("on-screen crossfader drives the engine", Math.abs(sliderXf - 0.1) < 0.02, `engine=${sliderXf}`);

// ---- 5. Pause stops a deck ----
await page
  .locator('section[aria-label="Deck A"]')
  .getByRole("button", { name: "pause deck A" })
  .click();
await page.waitForTimeout(200);
const aPaused = await page.evaluate(() => !window.__djEngine.decks.a.getState().playing);
check("pause stops deck A", aPaused);

// ---- 6. Hot cue pads: set at the playhead, jump back ----
await page.evaluate(() => window.__djEngine.decks.a.seek(0.5));
await page.locator('button[aria-label="hot cue 1 deck A"]').click();
const cueSec = await page.evaluate(() => window.__djEngine.decks.a.getState().hotCues[0]);
check(
  "hot cue pad stores the playhead position",
  cueSec !== null && Math.abs(cueSec - 0.5) < 0.05,
  `hotCues[0]=${cueSec}`,
);
await page.evaluate(() => window.__djEngine.decks.a.seek(1.5));
await page.locator('button[aria-label="hot cue 1 deck A"]').click();
const afterJump = await page.evaluate(() => window.__djEngine.decks.a.getState().positionSec);
check(
  "hot cue pad jumps back to the stored cue",
  Math.abs(afterJump - cueSec) < 0.15,
  `position=${afterJump.toFixed(3)} cue=${cueSec?.toFixed(3)}`,
);

// ---- 7. Waveform overview renders peaks ----
const litPixels = await page
  .locator('[aria-label="waveform deck A"] canvas')
  .first()
  .evaluate((c) => {
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 3; i < data.length; i += 40) if (data[i] > 0) lit++; // alpha
    return lit;
  });
check("waveform overview paints the track peaks", litPixels > 100, `${litPixels} lit samples`);

// ---- 8. Waveform click-to-seek ----
const wfBox = await page.locator('[aria-label="waveform deck A"]').boundingBox();
await page.mouse.click(wfBox.x + wfBox.width * 0.75, wfBox.y + wfBox.height / 2);
await page.waitForTimeout(100);
const seekFrac = await page.evaluate(() => {
  const s = window.__djEngine.decks.a.getState();
  return s.positionSec / s.durationSec;
});
check(
  "clicking the waveform at 75% seeks there",
  Math.abs(seekFrac - 0.75) < 0.05,
  `position=${(seekFrac * 100).toFixed(1)}%`,
);

// ---- 9. Tempo fader: keyboard nudge changes the playback rate ----
const tempoFader = page.getByRole("slider", { name: "tempo deck A" });
await tempoFader.focus();
await tempoFader.press("ArrowUp");
const rate = await page.evaluate(() => window.__djEngine.decks.a.getState().rate);
check("tempo fader keyboard nudge raises the rate", rate > 1.0005 && rate < 1.01, `rate=${rate}`);

// ---- 10. Console hygiene ----
const realErrors = errors.filter((e) => !/manifest|favicon/i.test(e));
check("no page errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | ") || "clean");

await page.screenshot({ path: "/tmp/dj-mode-verified.png" });
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
