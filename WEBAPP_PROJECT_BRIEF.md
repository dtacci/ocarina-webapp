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
| Audio | WaveSurfer.js 7.12 (real waveform rendering) |
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
- **Sample Editor Stub** (/sample-editor) — Placeholder page with "Drafts", "Your Samples", "Recent Edits" sections; wired into sidebar; WaveSurfer trimmer deferred to Phase 2
- **Diagnostics Dashboard Refactor** — Renamed "Metrics" → "Diagnostics"; moved from sidebar Tools to "My Account" dropdown (admin-only, design ready for future access control)

**Database (17 tables, +1 from v0.1):**
users, user_subscriptions, devices, samples, sample_vibes, sample_user_data, kits, recordings, loop_tracks, sessions, karaoke_songs, karaoke_lyrics, karaoke_user_data, sync_queue, device_configs, (+ sample_editor_lineage for Phase 2)

**Seeded Data:**
3,859 samples + 24,484 vibes + 12 kits + 1,084 karaoke songs + 213 sessions

**Feature Flags (lib/features.ts):**
Enabled: sampleBrowser, aiSearch, aiKitBuilder, kitBrowser, deviceRegistration, syncApi, activityTimeline, embeddablePlayer, configManager, recordingLibrary, karaokeBrowser, looperDA, drumPatternEditor, sampleEditor, analyticsDashboard, diagnostics

## What's Next (v0.2 Phase 2 & Beyond)

**v0.2 Phase 2 (Remaining):**
- **Looper Dashboard** — Visual representation of Teensy's 4-6 track loop state with waveform rendering
- **Sample Editor Phase 2** — WaveSurfer.js regions plugin for trimming (start/end markers, snap-to-zero crossing)
- **Global Audio Player Singleton** — Zustand store, persists across navigation
- **Realtime Bridge** — Supabase Realtime relay: Pi publishes Teensy STATUS → web subscribes
- **Pi Sync Agent** — Python daemon: FileWatcher + SQLite queue + presigned Blob uploads
- **MP3 Transcoding** — Pi-side Python (pydub/ffmpeg) before upload

Disabled flags (v0.2 Phase 2 ready):
- **looperDashboard**, **realtimeBridge**, **mp3Transcoding**, **piSyncAgent**

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
app/(dashboard)/library/       Parallel routes: layout.tsx + page.tsx + @filters/ + @grid/
components/audio/use-wavesurfer.ts   Custom WaveSurfer.js hook
lib/features.ts                37 feature flags controlling all route access
lib/db/queries/                All Supabase REST queries
lib/config/default-config.ts   70+ config fields matching pi/config.yaml
lib/ai/provider.ts             Async provider switching (Anthropic/OpenAI)
middleware.ts                  Auth + device API key validation
app/api/sync/                  Pi sync endpoints (5 routes)
app/api/ai/                    AI search + kit builder + provider toggle
```

## The Hardware Project

The webapp serves the Digital Ocarina — a voice-to-instrument synthesizer (Teensy 4.1 + Pi 5). 4,886 samples, 93 vibes, 12 kits, voice commands, multi-track looping, MIDI karaoke. Main repo: github.com/dtacci/digital-ocarina.
