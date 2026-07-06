# Interaction Event Vocabulary (v1)

The `interaction_events` table is the append-only capture layer for the ML
data flywheel. Devices batch events to `POST /api/sync/interactions`
(device API key); the browser posts to `POST /api/events` (session auth).
Writes only happen for users with `users.ml_consent = true` — the Pi learns
the flag from the heartbeat response (`interactions_enabled`) and the ingest
endpoint re-checks on every batch.

## Envelope

Every event carries: `schema_version` (this doc describes v1), `user_id`,
`device_id` (null = web), `session_id` (play session, when known),
`query_id` (groups a search with its outcomes), `event_type`, `sample_id`,
`source` (`pi` | `web`), `client_ts` (device clock), `payload` (JSONB),
`created_at` (server truth).

**Versioning rules:**
- Additive payload fields → keep `schema_version: 1`.
- Renames or semantic changes → bump `schema_version`; consumers filter on it.
- Rows are never mutated or hard-deleted. Consent-off means events are never
  created, not retro-deleted.

## Event types

### Voice / device (source: `pi`)

| event_type | payload |
|---|---|
| `voice_command` | `{ transcript, intent: {...}, confidence, llm_used: bool, llm_ms?, fallback: bool, thermal_skip?: bool }` — one per utterance, after intent parsing. The single highest-value training signal. |
| `search_executed` | `{ query_text?, vibes: string[], family?, filters?, results: [{ sample_id, score, rank }] }` — top-10 results denormalized into the event. Mint a fresh `query_id`. |
| `search_result_played` | `{ rank }` + `sample_id` + the originating `query_id`. |
| `search_result_skipped` | `{ rank }` + `sample_id` + `query_id` — user said "next"/browsed past. Played+skipped pairs per query_id are the reranker's labels. |
| `sample_played` | `{ trigger: "voice" \| "button" \| "random" \| "kit" }` + `sample_id`. |
| `pitch_contour_chunk` | `{ blob_url, start_ts, n_points }` — pointer to an NDJSON chunk uploaded via /api/sync/upload. Flag-gated, off by default. |

### Web (source: `web`)

| event_type | payload |
|---|---|
| `search_executed` | same shape as Pi; the AI search route logs it server-side and returns `query_id` to the client. |
| `search_result_played` / `search_result_skipped` | `{ rank }` + `sample_id` + `query_id`. |
| `search_result_rated` | `{ rank, rating: 1 \| -1 }` + `sample_id` + `query_id` — 👍/👎 on a result. |
| `description_edited` | `{ description_id, parent_description_id }` + `sample_id` — human edit of an LLM description (fine-tune pairs live in `sample_descriptions`). |
| `kit_built` | `{ prompt, kit_id? }` — AI kit-builder run. |
| `kit_accepted` | `{ kit_id }` — user saved/used the generated kit. |
| `cleanup_proposed` / `cleanup_accepted` / `cleanup_rejected` | `{ session_id, params_before, params_after, explanation? }` — transcription AI cleanup outcomes. |

## Related tables

- `ai_invocations` — raw prompt/completion log for every AI feature
  (`search`, `describe`, `kit-builder`, `transcribe-cleanup`). Eval suites and
  fine-tune corpora come from here.
- `sample_descriptions` — provenance chains (`parent_description_id`):
  LLM-proposed → human-edited pairs.
- `sample_embeddings` — model-versioned vectors; `kind='description'` today,
  `kind='audio'` (CLAP) later with no schema change.

## Data thresholds (when there's enough to train)

| Use | Needs |
|---|---|
| Search reranker v0 | ~500 query_ids containing both a played and a skipped result |
| Description-generator few-shot/tuning | 200–500 human-edit pairs |
| Voice-intent model upgrade | 1–2k `voice_command` events with outcome labels |
| CLAP fine-tune | ≥1k confirmed audio↔description pairs |
