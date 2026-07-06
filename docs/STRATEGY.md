# Strategy pointer — read the canonical doc

**The canonical strategy, roadmap, and status ledger for the whole Ocarina
system live in the device repo:**
`digital-ocarina/docs/STRATEGY_THREE_LOOPS.md`. **Edits happen there only** —
this file is a pointer so the two repos can't split-brain again.

## The webapp's role (July 5, 2026)

One instrument, two halves. The device (Teensy + Pi) is the **performance
half** — real-time, offline, <10ms. This webapp is the **memory +
intelligence half**: the instrument's **creative context engine**. It brings
music in (streams, generated beds, your own sessions), makes it jammable,
remembers what you played, and learns from it. Not "four apps to prune" —
one related feature set to streamline. DJ mode is first-class (future
hardware-controller surface).

Three loops to close, and what this repo owes each:

| Loop | Webapp deliverable |
|---|---|
| 1. SOUND (device-internal) | Nothing — firmware/Pi work |
| 2. SESSION (device→cloud) | **Stage A "Play it, keep it"**: session gallery — sessions + stems land automatically (SyncAgent → `/api/sync/*`, reviving `upload-url`/`confirm`), open straight into the sample editor |
| 3. INTELLIGENCE (cloud→device) | **Stage B "Hum it, hear the band"**: transcription → ensemble matcher → browser-side arrangement (Tone.js) over the user's stem; sample-metadata sync (Supabase canonical, device `index.json` generated) |

**Jam lane (parallel, desk-only):** J1 jam page — play a source (local
upload / Suno-generated bed / SoundCloud; Spotify Web Playback SDK behind a
flag) with the live device monitor overlaid; DJ-as-controller (map
`gpio_press`/pot telemetry to deck controls); J2 key/tempo detection + kit
suggestion; J3 improv-practice feedback.

## Standing contracts (from the canonical doc §5)

- Event vocabulary: `docs/EVENTS.md` here is the shared schema (v1).
- Don't delete `/api/sync/upload-url`, `/confirm`, `/loop-state` — they are
  the Stage A recording pipeline.
- Pi API v0.3.0 surface is stable; v0.4 additions are additive only.
- Transport policy: Pi REST/WS primary, Supabase Realtime fallback,
  WebSerial dev-only — extend via `useLiveConsoleSignals`' source
  discriminator, never a rewrite.
- Every new feature names its loop (or jam-lane stage) before it starts.
