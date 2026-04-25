# Progress — ocarina-webapp

Running log of what's shipped. See [`todo.md`](./todo.md) for upcoming work and future ideas.

## What This Is

Web companion for the Digital Ocarina (voice-to-instrument synthesizer). Dual purpose: (1) Vercel portfolio piece demonstrating deep platform expertise, and (2) real Phase 2 cloud platform for the hardware project.

- **Live**: ocarina-webapp.vercel.app
- **Repo**: github.com/dtacci/ocarina-webapp
- **Supabase**: fjdxoamvweitkyiqorca.supabase.co (us-east-2)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 App Router (React 19) |
| Auth | Supabase Auth + @supabase/ssr |
| Database | Supabase Postgres (16 tables, RLS on all) |
| File Storage | Vercel Blob |
| AI | Vercel AI SDK 6.x (Anthropic default, OpenAI switchable) |
| UI | Tailwind CSS + shadcn/ui (site chrome); bespoke primitives for sample editor |
| Audio | WaveSurfer.js 7.12 (waveform + regions + timeline), Tone.js 15.1 (realtime effect chain + `Tone.Offline` render), native Web Audio (`decodeAudioData` + `OfflineAudioContext` for peaks) |
| Theme | Dark mode, warm amber/gold (oklch), DM Serif Display + DM Sans + JetBrains Mono |

## v0.2 Mid (April 2026)

### Global Audio Player (feature-flagged)

Singleton audio engine behind `globalAudioPlayer` feature flag (starts disabled). When enabled, audio persists across page navigation — when disabled, cards fall back to per-component `<audio>` elements (original behavior). Toggle with a one-line flag flip + redeploy.

- **Zustand store** (`lib/stores/audio-player.ts`) — track, queue, status, time, volume, persist to localStorage
- **Engine** (`components/audio/audio-engine.ts`) — headless HTML5 `<audio>` singleton, throttled time updates (~4 Hz), Media Session API for lock-screen/headset controls
- **Provider + Bar** — `AudioPlayerProvider` (no DOM, pure side-effects) + `AudioPlayerBar` (sticky footer with transport, waveform, volume, resume chip); both conditionally mounted in dashboard layout
- **`usePlayback` adapter** (`hooks/use-playback.ts`) — cards call one hook that branches between the global store and a local `new Audio()` fallback based on the flag. No conditional rendering in card JSX
- **Mutual exclusion** — `useAudioTakeover` hook stops the global player when looper, sample editor, or karaoke mount
- **Keyboard shortcuts** — Space (toggle), ← → (seek ±5s), ↑ ↓ (volume), M (mute), N/P (next/prev)
- **Queue context** — `SampleListProvider` + `RecordingListProvider` give cards next/prev traversal through visible grids
- **Resume chip** — last-played track stored in localStorage; offers one-tap resume on re-entry

### Mic Recording — browser microphone capture

Adds a "Record" tab to the upload modal so users can capture audio directly in the browser (vocal direction, instrument demos, laptop-mic takes). Routes through the existing upload pipeline — zero backend changes.

- **`useMicrophoneRecord`** (`hooks/use-microphone-record.ts`) — MediaRecorder state machine (idle → requesting → ready → recording → captured), device enumeration via `enumerateDevices`, live `AnalyserNode` for metering, 5:00 warn / 10:00 hard cap, full `MediaStream` teardown on reset/unmount
- **`blobToWav`** (`lib/audio/decode-to-wav.ts`) — decodes MediaRecorder output (webm/opus on Chrome, mp4/aac on Safari) via `AudioContext.decodeAudioData`, re-encodes to PCM16 WAV via existing `encodeWav`
- **`RecordPanel`** — field-recording-rig aesthetic: corner tick brackets, INPUT ∙ ARMED ∙ REC LED cluster, channel-strip rows with mono uppercase labels, dB scale tick marks, hardware-key record button (amber aura when armed, oxide-pulsing when recording)
- **`InputLevelMeter`** — Web-Audio-native (`getFloatTimeDomainData`), amber/oxide, peak-hold at 8 dB/s, horizontal + vertical
- **Upload modal refactored** to tabbed "Add recording" (Upload file | Record), last tab persisted in localStorage
- **"Save & open in editor"** shortcut navigates directly to `/sample-editor/[id]`
- iOS-safe: `AudioContext` created/resumed inside the permission-grant click gesture; raw capture (echoCancellation/noiseSuppression/autoGainControl all off)

### Sample Editor v2 additions

- **Compressor card** — threshold, ratio, attack, release, makeup gain
- **Add / remove effects** via `+ ADD` command menu (Overlay primitive)
- **Drag-reorder effects** — HTML5 drag handlers on pedalboard cards
- **Loop crossfade** — micro-crossfade at loop points for seamless sustained samples

### Live Console — Pi telemetry + virtual keyboard

Real-time diagnostics at `/diagnostics/live` for webapp-triggered Pi interaction.

- **Telemetry stream** — `POST /api/sync/telemetry` receives Pi events; `useDeviceTelemetry` hook subscribes via polling
- **Virtual keyboard** — on-screen piano/button grid sends `sim_key` commands to the Pi (`POST /api/sync/commands`), rate-limited to 20/sec per device
- **FX state panel** — live view of the Pi's effect chain state
- **Event log** — scrolling real-time log of telemetry events
- **Sidebar integration** — "Console" link under diagnostics (Gamepad2 icon), gated by `liveConsole` flag, only renders when a device is online

### Other v0.2 Mid features

- **Device Pairing** — seamless Pi pairing via spoken 6-digit code
- **Device Deletion** — remove-device button on `/devices` cards
- **Dev tooling** — `useAudioPlayerStore` exposed on `window` in dev mode for DevTools inspection

## v0.2 Early (April 2026)

### Sample Editor — "field recordist's workbench"

Shipped in 7 phases. Full non-destructive audio editor at `/sample-editor`.

- **Landing** (`/sample-editor`) — drafts (user recordings awaiting refinement), your samples grid, recent edits ledger, lineage links
- **Editor route** (`/sample-editor/[id]`) — server wrapper with auth redirect; client shell with `useReducer` over `EditSpec`, undo/redo ring (cap 50), async WAV decode
- **Waveform** — WaveSurfer v7 peaks-only mode (no audio load), RegionsPlugin for draggable trim, TimelinePlugin tick ruler in mono, shift-held = snap to zero crossing via PCM scan
- **Signal chain** — horizontal pedalboard layout with 6 cards: `TRIM · FADE · FILTER · PITCH · REVERB · GAIN`. Each card has LED bypass toggle + amber left-border when enabled + optional chevron for advanced params
- **Bespoke primitives** — `Knob` (SVG arc, drag/wheel/arrows, log scale, role=slider), `LinearSlider`, `Dropdown`, `SegmentedGroup` (LED-on), `Overlay` (native `<dialog>`); **no shadcn in editor chrome** so the workbench voice stays intact
- **Transport** — custom A|B physical switch (120ms snap), play/stop/loop, live timecode (DOM ref, zero re-renders), post-chain peak meter (amber → oxide at clip, 8 dB/s hold fall)
- **Audio engine** — `lib/audio/tone-chain.ts`: `playRealtime()` builds Tone graph with `reverb.ready` awaited, returns controller with idempotent `stop()`; `renderOffline()` uses `Tone.Offline` for save-time render. Abort token pattern guards rapid stop/play races
- **Playhead sync** — rAF loop reads `Tone.getContext().currentTime`, writes via imperative handle on WaveformCanvas + DOM mutation on timecode → zero React re-renders at 60 fps during playback
- **Reverb debounce** — 300 ms window on decay param to avoid stacking async IR builds; `reverbBusy` state shows `…` spinner on card during window
- **Save-as-new** — `Tone.Offline` render → PCM16 WAV encode → Vercel Blob upload → `samples` row insert with `source_sample_id` (lineage FK) + `edit_spec` (jsonb chain for round-trip); amber sweep "bake" animation tied to `--bake-progress` CSS var; revalidates `/sample-editor` + `/library`; redirects to new sample's library page
- **Keyboard shortcuts** — `space` play/stop · `/` loop · `a` A/B · `[` `]` set trim in/out to playhead · `⌘z` / `⌘⇧z` undo/redo · `⌘s` save-as-new · `shift` zero-crossing snap
- **Design voice** — warm charcoal + rationed amber palette scoped via `.workbench` CSS class (doesn't leak to other pages); specimen-catalog copy (`SMP_0X4F7A` style IDs, lowercase everywhere, mono readouts with fixed decimals)

### Other v0.2 Early features

- **Optimistic Favorites & Ratings** — Heart toggle + 5-star rater on samples with instant UI feedback via `useOptimistic` + Server Actions (`sample_user_data` table)
- **Smart Sample Filters** — "My Library" section with favorites-only toggle and min-rating star picker; query intersection (vibe filters ∩ user-data)
- **Karaoke Favorites** — Feature parity with samples; toggleable heart on song cards; `karaoke_user_data` table with same UX pattern
- **Analytics Dashboard** (`/analytics`) — Session aggregates (total/avg/per-day), mode breakdown pie chart, day-of-week + hour-of-day histograms, top vibes/kits ranked; 30/90/180/365 day range selector; pure HTML/CSS charts (no charting library)
- **Auth Page Visual Overhaul** — Split-screen layout (left brand panel + right form), serif DM headline, sine wave SVG visualizer, glassmorphic cards, staggered fade-up animations (CSS-only), warm focus halos
- **Accessibility Guard** — `@media (prefers-reduced-motion: reduce)` silences all decorative animations; snaps to final visual states without breaking interactions
- **Diagnostics Dashboard Refactor** — Renamed "Metrics" → "Diagnostics"; moved from sidebar Tools to "My Account" dropdown (admin-only, design ready for future access control)

## v0.1 (initial — complete)

23 page routes, 47 components, 12 API routes at v0.1 release.

- **Sample Library Browser** — 3,859 samples, faceted filtering (family + vibes), pagination, parallel route segments (`@filters` + `@grid` load independently)
- **AI-Powered Sample Search** — natural language → structured query via `generateObject` + Zod
- **AI Kit Builder** — `streamObject` streaming UI, builds kit slot-by-slot in real-time
- **Kit Browser** — 12 presets with slot visualization, detail pages
- **Device Registration** — API key generation (SHA-256 hashed), device cards
- **Activity Timeline** — GitHub-style heatmap, stats cards, session feed (213 seeded sessions)
- **Recordings** — card grid with embeddable player at `/embed/[recordingId]`
- **Pi Sync API** — 5 REST endpoints (heartbeat, upload-url, confirm, config, sessions), device auth via Edge Middleware
- **Config Manager** — 70+ settings across 11 sections, versioned save, YAML download
- **Karaoke Browser** — 1,084 songs, decade/genre filters, pagination
- **AI Provider Toggle** — cookie-based Anthropic/OpenAI switching
- **Loading Skeletons** — `loading.tsx` on all 7 dashboard routes
- **Real Audio Waveforms** — WaveSurfer.js integration (custom `useWaveSurfer` hook)
- **Parallel Routes** — Library page splits `@filters` + `@grid` for independent streaming
- **Visual Polish** — film grain, stagger-fade animations, hover-lift, glow-amber, glassmorphic cards

## Database

**16 tables** (RLS on all), plus 2 columns added to `samples` for sample-editor lineage:

```
users · user_subscriptions · devices · samples · sample_vibes · sample_user_data
kits · recordings · loop_tracks · sessions · karaoke_songs · karaoke_lyrics
karaoke_user_data · sync_queue · device_configs
```

Sample editor additions (no new table): `samples.source_sample_id` (FK → `samples.id`, `ON DELETE SET NULL`) + `samples.edit_spec` (jsonb) — fork lineage and chain round-trip.

**Seeded data**: 3,859 samples · 24,484 vibes · 12 kits · 1,084 karaoke songs · 213 sessions.

## Feature flags (lib/features.ts)

**Enabled**: `sampleBrowser`, `aiSearch`, `aiKitBuilder`, `kitBrowser`, `deviceRegistration`, `syncApi`, `activityTimeline`, `embeddablePlayer`, `configManager`, `recordingLibrary`, `karaokeBrowser`, `looperDA`, `drumPatternEditor`, `sampleEditor`, `analyticsDashboard`, `diagnostics`, `liveConsole`.

**Disabled (ready to flip)**: `globalAudioPlayer`.

## Architecture decisions (don't revisit)

1. Supabase for auth + DB + realtime; Vercel for everything else (pragmatic split)
2. Server Actions for browser mutations, REST Route Handlers for device APIs
3. Supabase Realtime as Pi↔Web relay (~80–130 ms latency, acceptable for visual state)
4. URL-persisted filter state (shareable links, SSR of filtered results)
5. Pre-computed waveform peaks in DB (samples render without downloading audio)
6. Parallel route segments for sample browser (`@filters` + `@grid`)
7. Feature flags gate all routes and sidebar items
8. Sample editor uses bespoke primitives (not shadcn) — design voice depends on it
9. Sample editor playback uses imperative handle + DOM refs on the hot path — React state stays out of 60fps loops

## Key files

```
app/(dashboard)/library/             Parallel routes: layout.tsx + page.tsx + @filters/ + @grid/
app/(dashboard)/sample-editor/       Landing + [sampleId]/ editor route + actions.ts
app/api/samples/create/route.ts      Sample Editor save-as-new endpoint (blob + DB insert)
components/audio/use-wavesurfer.ts   Library list/detail WaveSurfer hook
components/sample-editor/            Workbench editor: editor.tsx + waveform-canvas.tsx +
                                     transport-bar.tsx + effect-chain.tsx + effect-cards/ +
                                     primitives/ (knob, linear-slider, dropdown, segmented-group,
                                     overlay) + peak-meter + ab-switch + bake-overlay + metadata-panel
lib/audio/tone-chain.ts              playRealtime + renderOffline, Tone.js effect graph
lib/audio/editor-types.ts            EffectNode discriminated union + EditSpec + defaults
lib/audio/wav-encoder.ts             AudioBuffer → PCM16 RIFF/WAVE encoder
lib/audio/compute-peaks.ts           Shared 200-point peak computation
lib/audio/zero-crossing.ts           Snap-to-zero helper for click-free trims
lib/features.ts                      Feature flags controlling all route access
lib/db/queries/                      All Supabase REST queries (+ sample-editor.ts)
lib/config/default-config.ts         70+ config fields matching pi/config.yaml
lib/ai/provider.ts                   Async provider switching (Anthropic/OpenAI)
middleware.ts                        Auth + device API key validation
app/api/sync/                        Pi sync endpoints (5 routes)
app/api/ai/                          AI search + kit builder + provider toggle
```

## The hardware project

The webapp serves the Digital Ocarina — a voice-to-instrument synthesizer (Teensy 4.1 + Pi 5). 4,886 samples, 93 vibes, 12 kits, voice commands, multi-track looping, MIDI karaoke. Main repo: github.com/dtacci/digital-ocarina.
