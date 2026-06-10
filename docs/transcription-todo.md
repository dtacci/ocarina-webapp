# Transcription (Ocarina → Sheet Music) — TODO & Known Issues

Status as of the Phase-1 build. The core feature is live and working: device/dev
ingest → derivation → OSMD notation, with interpretation controls, render cache,
synth playback (flash-highlighted, auto-scroll), click-a-note to seek/preview,
zoom, transpose, inline title, share links, confidence badge + faint
low-confidence notes, rename/delete in the browse list, MusicXML/MIDI export,
and print.

Reference design doc: `~/Documents/ideas/digital_ocarina/ocarina-transcription-plan.md`.

There is now a headless-browser test for the notation player —
`node scripts/verify-notation-playback.mjs` (see its header for setup). Run it
after touching `notation-canvas`, `tone-midi-player`, or `transcription-detail`.

---

## Resolved (verified in a real browser via the script above)

- **Click-a-note-to-hear — works now.** Clicking any note seeks the synth to
  that note (highlight + timeline jump, mid-playback too) and previews its
  pitch when paused. What was actually wrong with the blind attempts: the
  `.vf-notehead`/`.vf-stavenote` classes DO exist and are clickable
  (`pointer-events="bounding-box"`), but (a) the page has ~16 `<svg>`s — the
  lucide toolbar icons — so unscoped `querySelector("svg")` grabs the wrong
  one (the score is `#osmdSvgPage1`), (b) OSMD's *internal* layout boxes are
  degenerate (the `width not > 0` warning) so hit-testing must use live DOM
  `getBoundingClientRect`, and (c) per-element listeners die whenever OSMD
  re-renders (zoom/autoResize). The fix in `notation-canvas.tsx`: one cursor
  sweep per render builds a step map (timestamp → live SVG els → pitch), one
  delegated click listener on the container, staleness detected via
  `el.isConnected` and the map rebuilt on demand. The synth side exposes
  `seekTo`/`previewNote` through a `registerApi` callback (refs don't pass
  through `next/dynamic`).

---

## Known issues / needs eyes-on a real render

- **Glissando not rendering.** `musicxml-gen.ts` emits valid paired
  `<glissando type="start|stop">`, but no wavy line appears. Suspect OSMD's
  `drawingParameters: "compact"` (in `notation-canvas.tsx`) disables slur/gliss
  rendering, or the markup needs `<slide>` instead. Low priority.

- **OSMD `SkyBottomLineBatchCalculatorBackend: width not > 0 in measure N`.**
  Recurring console warning during render — OSMD computes degenerate *internal*
  measure widths. Confirmed harmless to the rendered geometry (the live SVG
  rects are correct, which is why click hit-testing works); it's console noise.
  If it ever matters: suspects are container width at render time, compact
  mode, or OSMD version.

- **PWA `manifest.webmanifest` syntax error** (`Line 1, column 1`). Pre-existing
  and unrelated to transcription, but it shows in the console on every page —
  the manifest is probably being served as HTML (404/redirect) rather than JSON.

---

## Deferred features (intentional, from the plan)

- **Server-side PDF export** — needs Puppeteer/`@sparticuz/chromium`; heavy/costly
  Vercel function. The browser **Print** button is the v1 stand-in;
  `transcription_renders.pdf_blob_url` is reserved for it.
- **Browse thumbnails** — pre-rendered first-system previews need a headless OSMD
  render (same infra problem as server PDF). Browse is a text/card list for now.
- **Long-session chapters UI** — `chapters.ts` computes split points (>5 min);
  the multi-canvas UI isn't built.
- **Mobile drawer + horizontal-snap score** (doc §6.5) — do once tested on a phone.
- **Observability** (doc §8) — only console-level today; no metrics/alerts.

---

## Future ideas (post-Phase-1)

- **AI cleanup** — "this looks wrong, fix it" → Claude returns corrected MusicXML.
  Uses `@ai-sdk/anthropic` (already in the stack); the `transcription_feedback`
  table + the confidence data are its inputs. Best after real vocal recordings.
- **Practice / karaoke comparison** — score a sung performance against one of the
  888 known karaoke melodies.
- **Live recording view** — real-time piano-roll while the device records (doc §6.3).
- **Direct note editing** — drag notes / fix pitches (doc §6.4); its own project.

---

## Operational notes

- **Phase 2 (device) is wired but untested with hardware.** `/api/sync/confirm`
  routes `recording_type === 'transcription_session'` (or `fileType: 'transcription'`)
  through `ingestSession`. Needs a real `.ocrec.jsonl` from the Teensy to verify.
- **Disable/gate the dev ingest route before real users.** `/api/transcription/ingest-dev`
  lets any authenticated user create transcription sessions. Fine for now; gate
  behind an admin check or env flag for production.
- **Confidence badge / faint notes populate on freshly-derived renders.** Existing
  demo renders predate the confidence change; the badge appears after any control
  tweak (re-derive) or on new imports.
- **Demo seed data** lives in the DB under the owner account (Twinkle, Mary, Jig,
  "beyer-no88 (MIDI import)"). Delete anytime.
- **Migrations** `drizzle/0009` (transcription tables) and `0010` (feedback) were
  applied to the live Supabase project via MCP; the SQL files are committed.
- **Dev/demo scripts:** `scripts/transcription-demo.ts` (terminal derivation),
  `scripts/transcription-ingest-check.ts` (end-to-end ingest), and
  `scripts/midi-to-transcription.ts` (import a MIDI file's melody as a session).
