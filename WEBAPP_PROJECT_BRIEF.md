# Ocarina Webapp — Project Context

## What This Is

Web companion for the Digital Ocarina (voice-to-instrument synthesizer). Dual purpose: (1) Vercel interview portfolio piece demonstrating deep platform expertise, and (2) real Phase 2 cloud platform for the hardware project.

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
| UI | Tailwind CSS + shadcn/ui |
| Audio | WaveSurfer.js 7.12 (waveform + regions + timeline), Tone.js 15.1 (realtime effect chain + Tone.Offline render), native Web Audio (decode + OfflineAudioContext for peaks) |
| Theme | Dark mode, warm amber/gold (oklch), DM Serif Display + DM Sans + JetBrains Mono |

## What's Built (v0.1 + v0.2 Early — COMPLETE)

23 page routes, 47 components, 12 API routes.

**v0.1 Features:**
- Sample Library Browser — 3,859 samples, faceted filtering (family + vibes), pagination, parallel route segments (@filters + @grid load independently)
- AI-Powered Sample Search — natural language → structured query via generateObject + Zod
- AI Kit Builder — streamObject streaming UI, builds kit slot-by-slot in real-time
- Kit Browser — 12 presets with slot visualization, detail pages
- Device Registration — API key generation (SHA-256 hashed), device cards
- Activity Timeline — GitHub-style heatmap, stats cards, session feed (213 seeded sessions)
- Recordings — card grid with embeddable player at /embed/[recordingId]
- Pi Sync API — 5 REST endpoints (heartbeat, upload-url, confirm, config, sessions), device auth via Edge Middleware
- Config Manager — 70+ settings across 11 sections, versioned save, YAML download
- Karaoke Browser — 1,084 songs, decade/genre filters, pagination
- AI Provider Toggle — cookie-based Anthropic/OpenAI switching
- Loading Skeletons — loading.tsx on all 7 dashboard routes
- Real Audio Waveforms — WaveSurfer.js integration (custom useWaveSurfer hook)
- Parallel Routes — Library page splits @filters + @grid for independent streaming
- Visual Polish — film grain, stagger-fade animations, hover-lift, glow-amber, glassmorphic cards

**v0.2 Early Features (Apr 2026):**
- **Optimistic Favorites & Ratings** — Heart toggle + 5-star rater on samples with instant UI feedback via `useOptimistic` + Server Actions (sample_user_data table)
- **Smart Sample Filters** — "My Library" section with favorites-only toggle and min-rating star picker; query intersection (vibe filters ∩ user-data)
- **Karaoke Favorites** — Feature parity with samples; toggleable heart on song cards; karaoke_user_data table with same UX pattern
- **Analytics Dashboard** (/analytics) — Session aggregates (total/avg/per-day), mode breakdown pie chart, day-of-week + hour-of-day histograms, top vibes/kits ranked; 30/90/180/365 day range selector; pure HTML/CSS charts (no charting library)
- **Auth Page Visual Overhaul** — Split-screen layout (left brand panel + right form), serif DM headline, sine wave SVG visualizer, glassmorphic cards, staggered fade-up animations (CSS-only, no JS), warm focus halos
- **Accessibility Guard** — `@media (prefers-reduced-motion: reduce)` silences all decorative animations; snaps to final visual states without breaking interactions
- **Sample Editor** (/sample-editor) — Full "field recordist's workbench" editor shipped in 7 phases. Landing with drafts + user samples + lineage ledger; per-sample editor at `/sample-editor/[id]` with WaveSurfer regions trimmer (shift = snap to zero crossing), timeline tick ruler, horizontal signal-chain with 6 effects (trim · fade · filter · pitch · reverb · gain), custom physical A|B bypass switch, post-chain peak meter, rAF playhead sync via imperative handle (zero React re-renders at 60fps), Tone.js realtime + Tone.Offline save render, PCM16 WAV encode, Vercel Blob upload, non-destructive forks via `samples.source_sample_id` + `samples.edit_spec` JSONB, amber bake-on-save animation, full keyboard shortcuts (space · / · a · [ ] · ⌘z · ⌘⇧z · ⌘s · shift). Bespoke primitives (Knob/LinearSlider/Dropdown/SegmentedGroup/Overlay) — no shadcn in editor chrome. Warm charcoal + rationed amber palette scoped via `.workbench` CSS class.
- **Diagnostics Dashboard Refactor** — Renamed "Metrics" → "Diagnostics"; moved from sidebar Tools to "My Account" dropdown (admin-only, design ready for future access control)

**Database (16 tables, +2 columns on `samples`):**
users, user_subscriptions, devices, samples, sample_vibes, sample_user_data, kits, recordings, loop_tracks, sessions, karaoke_songs, karaoke_lyrics, karaoke_user_data, sync_queue, device_configs. Sample Editor added `samples.source_sample_id` (FK to samples.id, ON DELETE SET NULL) + `samples.edit_spec` (jsonb) for fork lineage and chain round-trip — no new table.

**Seeded Data:**
3,859 samples + 24,484 vibes + 12 kits + 1,084 karaoke songs + 213 sessions

**Feature Flags (lib/features.ts):**
Enabled: sampleBrowser, aiSearch, aiKitBuilder, kitBrowser, deviceRegistration, syncApi, activityTimeline, embeddablePlayer, configManager, recordingLibrary, karaokeBrowser, looperDA, drumPatternEditor, sampleEditor, analyticsDashboard, diagnostics

## What's Next (v0.2 Phase 2 & Beyond)

**v0.2 Phase 2 (Remaining):**
- **Looper Dashboard** — Visual representation of Teensy's 4-6 track loop state with waveform rendering
- **Global Audio Player Singleton** — Zustand store, persists across navigation
- **Realtime Bridge** — Supabase Realtime relay: Pi publishes Teensy STATUS → web subscribes
- **Pi Sync Agent** — Python daemon: FileWatcher + SQLite queue + presigned Blob uploads
- **MP3 Transcoding** — Pi-side Python (pydub/ffmpeg) before upload

Disabled flags (v0.2 Phase 2 ready):
- **looperDashboard**, **realtimeBridge**, **mp3Transcoding**, **piSyncAgent**

### Sample Editor v2 Backlog (deferred, not blocking)

- **Overwrite save** — gate `save` (vs `save as new`) by `sample.user_id === currentUserId`; update existing row + blob in place
- **Chain restore on reopen** — re-seed reducer from `samples.edit_spec` when a fork is opened (currently always defaults); needs care to avoid double-applying effects since the WAV is already baked
- **`samples.title` column** — promote the editor's metadata `name` field to a real DB column so library cards can show human-readable names (today `id` is shown)
- **Compressor** effect (threshold, ratio, attack, release, makeup)
- **Normalize / LUFS target** — integrated-loudness render pass for broadcast-ready output
- **Spectrogram view** — WebGL canvas toggle over the waveform
- **Silence auto-trim** — detect sub-threshold head/tail regions and offer a one-click crop
- **Preset chains** — "lo-fi warm", "field-recording cleanup", savable user presets
- **Loop crossfade** — micro-crossfade at loop points for seamless sustained samples
- **Time-stretch** — independent of pitch (Tone.GrainPlayer or WSOLA)
- **Mobile touch pass** — current layout degrades gracefully but isn't optimized for single-thumb editing
- **LUFS + True Peak meter** — alongside the current peak meter
- **Drag reorder effects** — effect-chain accepts the action already; just needs HTML5 drag handlers on cards
- **Add / remove effects via "+ ADD"** — reducer + Overlay component exist; just needs the command-menu UI wiring

## v0.3 (Future)

looperWaveforms, quantizationControls, sampleDragDrop, drumPatternEditor, karaokeDisplay, lyricsEditor, shareLinks, userProfiles, subscriptionTiers, pwa

## Architecture Decisions (Don't Revisit)

1. Supabase for auth + DB + realtime; Vercel for everything else (pragmatic split)
2. Server Actions for browser mutations, REST Route Handlers for device APIs
3. Supabase Realtime as Pi↔Web relay (~80-130ms latency, acceptable for visual state)
4. URL-persisted filter state (shareable links, SSR of filtered results)
5. Pre-computed waveform peaks in DB (samples render without downloading audio)
6. Parallel route segments for sample browser (@filters + @grid)
7. Feature flags gate all routes and sidebar items

## Key Files

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

## The Hardware Project

The webapp serves the Digital Ocarina — a voice-to-instrument synthesizer (Teensy 4.1 + Pi 5). 4,886 samples, 93 vibes, 12 kits, voice commands, multi-track looping, MIDI karaoke. Main repo: github.com/dtacci/digital-ocarina.
