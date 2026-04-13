# TODO — ocarina-webapp

Living list of upcoming work + future ideas. **Anything worth remembering but without a home goes here** — better captured than lost to a cleared terminal context.

For what's already shipped: see [`progress.md`](./progress.md).

## Conventions

- **Next up** — concrete near-term work, roughly sequenced
- **Feature backlogs** — deferred items tied to a specific feature area
- **Ideas park** — the catch-all. Unstructured. Drop stuff here as it comes up
- When something ships, move its bullet over to `progress.md`

---

## Next up — v0.2 Phase 2 (remaining)

- **Looper Dashboard** — visual representation of Teensy's 4–6 track loop state with waveform rendering
- **Global Audio Player Singleton** — Zustand store, persists across navigation so audio doesn't stop on route change
- **Realtime Bridge** — Supabase Realtime relay: Pi publishes Teensy STATUS → web subscribes (~80–130 ms)
- **Pi Sync Agent** — Python daemon: FileWatcher + SQLite queue + presigned Blob uploads
- **MP3 Transcoding** — Pi-side Python (pydub/ffmpeg) before upload

Feature flags already declared (disabled) for these: `looperDashboard`, `realtimeBridge`, `mp3Transcoding`, `piSyncAgent`.

---

## Sample Editor — v2 backlog

Deferred from the v1 ship. Not blocking — the editor is fully usable without these. Ordered roughly by user-visible value.

### Data + persistence
- **`samples.title` column** — promote the metadata `name` field to a real DB column so library cards show human-readable names (today the raw `id` is shown)
- **Overwrite save** — gate `save` (vs `save as new`) by `sample.user_id === currentUserId`; update existing row + blob in place
- **Chain restore on reopen** — re-seed reducer from `samples.edit_spec` when a fork is opened (currently always defaults). **Tricky**: the WAV is already baked, so re-applying the chain would double-process. Decide the right semantics — probably "show chain as a read-only recipe, default new edits to empty"

### More effects
- **Compressor** — threshold, ratio, attack, release, makeup gain
- **Normalize / LUFS target** — integrated-loudness render pass for broadcast-ready output
- **Time-stretch** — independent of pitch (Tone.GrainPlayer or WSOLA)

### Analysis + display
- **Spectrogram view** — WebGL canvas toggle over the waveform
- **LUFS + True Peak meter** — alongside the current peak meter
- **Silence auto-trim** — detect sub-threshold head/tail regions, offer a one-click crop

### UX
- **Preset chains** — "lo-fi warm", "field-recording cleanup", savable user presets
- **Loop crossfade** — micro-crossfade at loop points for seamless sustained samples
- **Drag reorder effects** — reducer already supports `REORDER_EFFECTS`; just needs HTML5 drag handlers on cards
- **Add / remove effects via `+ ADD` menu** — reducer supports `ADD_EFFECT` / `REMOVE_EFFECT`; Overlay primitive exists; needs the command-menu UI wiring
- **Mobile touch pass** — current layout degrades gracefully but isn't optimized for single-thumb editing

---

## v0.3 (future)

Feature flags declared (disabled) for:

`looperWaveforms` · `quantizationControls` · `sampleDragDrop` · `drumPatternEditor` · `karaokeDisplay` · `lyricsEditor` · `shareLinks` · `userProfiles` · `subscriptionTiers` · `pwa`

Each of these will get a fuller description when we pick one up — for now the names are placeholders for intent.

---

## Ideas park

Random thoughts, "wouldn't it be cool if…", future directions. Nothing is committed. Move items up to a real section when they firm up.

_Empty for now. When something sparks, drop it here with a one-line "why" so future-you remembers the spark._

<!--
Template:
- **Idea name** — one sentence on what it is and why it might be worth doing. Link to any relevant convo/context.
-->
