// E2E verification for the transcription notation component: playback
// highlight timing, click-a-note-to-seek/preview, and robustness across
// zoom re-renders, OSMD autoResize, and playback-speed changes.
//
// The notation renders client-side in OSMD, so this is the only way to test
// it for real (unit tests can't see the SVG). Run it whenever notation-canvas,
// tone-midi-player, or transcription-detail change.
//
// Setup (one-time; playwright is intentionally not a project dependency):
//   npm i --no-save playwright && npx playwright install chromium-headless-shell
// Usage (dev server must be running, and the target recording public):
//   node scripts/verify-notation-playback.mjs [transcription-url]
import { chromium } from "playwright";

const URL =
  process.argv[2] ??
  "http://localhost:3000/transcriptions/2dc98f18-2423-4b56-8886-6291907de8dc";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("#osmdSvgPage1 .vf-stavenote", { timeout: 30000 });
const waitForPlayerReady = () =>
  page.waitForFunction(() => {
    const input = document.querySelector('input[type="range"][step="0.1"]');
    return input && !input.disabled;
  }, { timeout: 30000 });
await waitForPlayerReady();
await page.waitForTimeout(500);

/** Click the n-th notehead; report whether it became the highlighted note. */
const clickAndCompare = async (noteIndex) => {
  const target = page.locator("#osmdSvgPage1 .vf-notehead").nth(noteIndex);
  await target.scrollIntoViewIfNeeded();
  await target.click({ force: true });
  await page.waitForTimeout(300);
  return page.evaluate((idx) => {
    const heads = [...document.querySelectorAll("#osmdSvgPage1 .vf-notehead")];
    const clickedStave = heads[idx]?.closest(".vf-stavenote");
    const active = [...document.querySelectorAll("#osmdSvgPage1 .osmd-note-active")];
    const input = document.querySelector('input[type="range"][step="0.1"]');
    return {
      match: active.some((a) => a === clickedStave),
      t: input ? parseFloat(input.value) : -1,
    };
  }, noteIndex);
};

const headCount = await page.locator("#osmdSvgPage1 .vf-notehead").count();
const idxA = Math.min(20, Math.max(0, headCount - 2));
const idxB = Math.min(60, headCount - 1);

// ---- 1. Click-to-seek + immediate highlight ----
const base = await clickAndCompare(idxA);
check("click seeks the player and highlights that note", base.match && base.t > 0, `t=${base.t}s`);

// ---- 2. Playback: highlight advances monotonically from the clicked note ----
await page.locator("button.rounded-full").first().click();
const samples = [];
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(700);
  samples.push(
    await page.evaluate(() => {
      const staves = [...document.querySelectorAll("#osmdSvgPage1 .vf-stavenote")];
      const active = document.querySelector("#osmdSvgPage1 .osmd-note-active");
      const stave = active ? (active.closest(".vf-stavenote") ?? active) : null;
      return stave ? staves.indexOf(stave) : -1;
    }),
  );
}
const idxs = samples.filter((i) => i >= 0);
check(
  "highlight advances in time during playback",
  idxs.every((v, i) => i === 0 || v >= idxs[i - 1]) && idxs.at(-1) > idxs[0],
  `indices over ~7s: ${samples.join(", ")}`,
);
check("playback starts from the clicked note", idxs[0] >= idxA - 2, `first=${idxs[0]}, clicked≈${idxA}`);

// ---- 3. Click mid-playback → timeline jumps there ----
await page.locator("#osmdSvgPage1 .vf-notehead").nth(idxB).click({ force: true });
await page.waitForTimeout(800);
const jump = await page.evaluate(() => {
  const staves = [...document.querySelectorAll("#osmdSvgPage1 .vf-stavenote")];
  const active = document.querySelector("#osmdSvgPage1 .osmd-note-active");
  const stave = active ? (active.closest(".vf-stavenote") ?? active) : null;
  return stave ? staves.indexOf(stave) : -1;
});
check("clicking mid-playback jumps the timeline", jump >= idxB - 2 && jump <= idxB + 6, `active=${jump}, clicked≈${idxB}`);
// Pause again for the re-render checks below.
await page.locator("button.rounded-full").first().click();

// ---- 4. Zoom re-render replaces the SVG; clicks + highlight must survive ----
await page.getByLabel("Zoom in").click();
await page.waitForTimeout(800);
const zoomed = await clickAndCompare(idxA);
check("click after zoom re-render", zoomed.match, `t=${zoomed.t}s`);
check("seek time consistent across zoom", Math.abs(zoomed.t - base.t) < 0.2, `${base.t}s vs ${zoomed.t}s`);

// ---- 5. autoResize re-render (viewport change) behind the component's back ----
await page.setViewportSize({ width: 1000, height: 900 });
await page.waitForTimeout(1200);
const resized = await clickAndCompare(Math.min(40, headCount - 1));
check("click after autoResize re-render", resized.match, `t=${resized.t}s`);

// ---- 6. Speed 0.5×: same note lands at 2× the transport seconds ----
await page.getByRole("button", { name: "0.5×" }).click();
await waitForPlayerReady();
await page.waitForTimeout(500);
const slow = await clickAndCompare(idxA);
check("click at 0.5× speed still lands on the note", slow.match, `t=${slow.t}s`);
check("0.5× seek time ≈ 2× the 1× time", Math.abs(slow.t - base.t * 2) < 0.4, `${base.t}s → ${slow.t}s`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | ") || "clean");

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
