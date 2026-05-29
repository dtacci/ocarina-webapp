# Transcription (Ocarina → Sheet Music) — TODO & Known Issues

Status as of the Phase-1 build. The core feature is live and working: device/dev
ingest → derivation → OSMD notation, with interpretation controls, render cache,
synth playback (flash-highlighted, auto-scroll), zoom, transpose, inline title,
share links, confidence badge + faint low-confidence notes, rename/delete in the
browse list, MusicXML/MIDI export, and print.

Reference design doc: `~/Documents/ideas/digital_ocarina/ocarina-transcription-plan.md`.

---

## Known issues / needs eyes-on a real render

These need someone to inspect the rendered OSMD output in a browser (the agent
built them blind and couldn't verify). Fastest path to fix: a short screen
recording with the console open, or paste the relevant console line.

- **Click-a-note-to-hear — removed.** Multiple approaches failed to register
  clicks (`getSVGGElement` wrapper, bounding-box hit-test, per-note listeners,
  `.vf-notehead` DOM pairing). Likely OSMD's SVG structure / class names differ
  from what was tried, compounded by the degenerate layout boxes (see below).
  To finish: open the score, inspect a notehead's actual SVG element/class, and
  wire listeners to that. The pitch source (`note.Pitch.Frequency`) is known-good.

- **Glissando not rendering.** `musicxml-gen.ts` emits valid paired
  `<glissando type="start|stop">`, but no wavy line appears. Suspect OSMD's
  `drawingParameters: "compact"` (in `notation-canvas.tsx`) disables slur/gliss
  rendering, or the markup needs `<slide>` instead. Low priority.

- **OSMD `SkyBottomLineBatchCalculatorBackend: width not > 0 in measure N`.**
  Recurring console warning during render — OSMD computes degenerate measure
  widths. The score still renders, but this likely underlies the click/geometry
  problems above. Worth investigating (container width at render time? compact
  mode? OSMD version?).

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
