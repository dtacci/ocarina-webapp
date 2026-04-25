# TODO — ocarina-webapp

Living list of upcoming work + future ideas. **Anything worth remembering but without a home goes here** — better captured than lost to a cleared terminal context.

For what's already shipped: see [`progress.md`](./progress.md).

## Conventions

- **Next up** — concrete near-term work, roughly sequenced
- **Feature backlogs** — deferred items tied to a specific feature area
- **Ideas park** — the catch-all. Unstructured. Drop stuff here as it comes up
- When something ships, move its bullet over to `progress.md`

---

## Next up

- **Looper Dashboard** — visual representation of Teensy's 4–6 track loop state with waveform rendering
- **Realtime Bridge** — Supabase Realtime relay: Pi publishes Teensy STATUS → web subscribes (~80–130 ms)
- **Pi Sync Agent** — Python daemon: FileWatcher + SQLite queue + presigned Blob uploads
- **MP3 Transcoding** — Pi-side Python (pydub/ffmpeg) before upload
- **Flip `globalAudioPlayer: true`** — the global audio player is merged and feature-flagged; manual-test both modes in a preview deploy, then decide whether to enable by default

Feature flags already declared (disabled) for these: `looperDashboard`, `realtimeBridge`, `mp3Transcoding`, `piSyncAgent`, `globalAudioPlayer`.

### Mic Recording — v2 backlog (after merge)

**Capture ergonomics:**
- **Countdown pre-roll** — optional 3-2-1 before record starts, for musicians who need a cue. Gated by a small `countdown` toggle
- **Metronome click track** — in-ear click while recording (not mixed into capture). Needs BPM input, reuses drum-engine click
- **Punch-in / punch-out** — mark a section of an existing take to re-record over. Belongs to the editor, not the capture panel
- **Auto-gain calibration** — short 2-second "say a test line" step, then set the `getUserMedia` volume constraint so the user hits −12 dBFS average. Right now we intentionally disable AGC for musical fidelity; this would be a guided one-shot calibration, not continuous AGC
- **Take history within a session** — let the user keep a "scratch" stack of takes and pick the best, rather than discarding on re-record. Needs IndexedDB or in-memory ring buffer

**Audio quality:**
- **Sample-rate honesty** — expose the capture sample rate in the UI (today we take whatever the browser gives us, typically 44.1k or 48k) and warn if it mismatches the project rate
- **Stereo capture toggle** — most laptop mics are mono-equivalent even when stereo; offer an explicit mono/stereo switch with a note about interface inputs
- **Silence auto-trim on save** — detect sub-threshold head/tail, offer a one-click crop before upload (shares logic with the sample-editor silence auto-trim item)
- **Real-time scrolling waveform during recording** — deliberately cut from v1 for scope. Would be a `<canvas>` + ring buffer fed from the analyser. Nice-to-have, not required
- **LUFS meter during capture** — broadcast-grade level reference alongside peak

**Flow + integration:**
- **Direct-to-editor mode** — skip the modal entirely from the `/sample-editor` drafts page: a "Record new" card that opens an inline record surface, auto-navigates to editor on stop. Power-user shortcut
- **Resume in-progress capture** — if the modal is closed mid-record, ask before teardown and offer "save what I have" instead of losing the take
- **Realtime appearance in drafts list** — already works via `hooks/use-recordings-realtime.ts` INSERT subscription. Verify in manual test and document if it needs more polish
- **Share-link preview of a freshly recorded take** — before any editor processing, since the editor save path is the canonical share point today

**Platform + compatibility:**
- **Bluetooth / AirPods gotcha** — BT audio devices force-enable AEC in Chrome and silently drop sample rate to 16k. Add a detect-and-warn when the selected device is BT
- **Permission recovery UX** — "denied" copy currently suggests site settings; could deep-link to `chrome://settings/content/microphone` on Chrome, improve Safari copy
- **Firefox quirks** — MediaRecorder mimeType probing order, test and document
- **Mobile layout audit** — RecordPanel is tight inside a 28rem modal on desktop; needs a touch-first single-column review on phones

**Accessibility:**
- **Keyboard shortcuts in RecordPanel** — `R` to record, `S`/`space` to stop, `Enter` to save. Align with editor's transport bindings
- **Screen reader live regions** — announce state transitions (recording started, hard cap approaching). The `aria-live="off"` on timecode is intentional (would be chatty), but transitions deserve a polite region
- **Reduced-motion** — pulse animation on the record button should honor `prefers-reduced-motion` like the rest of the app (`auth-pulse` already does this pattern)

---

## Sample Editor — remaining backlog

### Data + persistence
- **`samples.title` column** — promote the metadata `name` field to a real DB column so library cards show human-readable names (today the raw `id` is shown)
- **Overwrite save** — gate `save` (vs `save as new`) by `sample.user_id === currentUserId`; update existing row + blob in place
- **Chain restore on reopen** — re-seed reducer from `samples.edit_spec` when a fork is opened (currently always defaults). **Tricky**: the WAV is already baked, so re-applying the chain would double-process. Decide the right semantics — probably "show chain as a read-only recipe, default new edits to empty"

### More effects
- **Normalize / LUFS target** — integrated-loudness render pass for broadcast-ready output
- **Time-stretch** — independent of pitch (Tone.GrainPlayer or WSOLA)

### Analysis + display
- **Spectrogram view** — WebGL canvas toggle over the waveform
- **LUFS + True Peak meter** — alongside the current peak meter
- **Silence auto-trim** — detect sub-threshold head/tail regions, offer a one-click crop

### UX
- **Preset chains** — "lo-fi warm", "field-recording cleanup", savable user presets
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
