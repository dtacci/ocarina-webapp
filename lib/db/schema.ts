import {
  pgTable,
  uuid,
  text,
  boolean,
  smallint,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================================
// ENUMS
// ============================================================================

export const tierEnum = pgEnum("tier", ["free", "plus", "studio"]);
export const deviceTypeEnum = pgEnum("device_type", [
  "pi_pro",
  "web_browser",
  "mobile_app",
  "arduino_lite",
]);
export const sampleCategoryEnum = pgEnum("sample_category", [
  "acoustic",
  "percussion",
  "fx",
]);
export const sampleFamilyEnum = pgEnum("sample_family", [
  "strings",
  "brass",
  "woodwind",
  "keys",
  "mallet",
  "drums",
  "guitar",
  "other_perc",
  "other",
  "fx",
]);
export const trackStateEnum = pgEnum("track_state", [
  "empty",
  "recorded",
  "muted",
]);
export const sessionModeEnum = pgEnum("session_mode", [
  "instrument",
  "karaoke",
  "madlibs",
  "looper",
]);
export const karaokeSourceEnum = pgEnum("karaoke_source", [
  "midi",
  "wav",
  "both",
]);
export const lyricsSourceEnum = pgEnum("lyrics_source", [
  "midi_embedded",
  "user_contributed",
  "auto_generated",
]);
export const syncFileTypeEnum = pgEnum("sync_file_type", [
  "recording",
  "config",
  "sample",
  "session",
]);
export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "uploading",
  "complete",
  "failed",
]);
export const configSourceEnum = pgEnum("config_source", [
  "device",
  "web",
  "mobile",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "past_due",
]);

// ============================================================================
// IDENTITY & DEVICES
// ============================================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // FK to auth.users — linked via Supabase trigger
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  tier: tierEnum("tier").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tier: tierEnum("tier").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: subscriptionStatusEnum("status").notNull().default("active"),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  deviceType: deviceTypeEnum("device_type").notNull(),
  apiKeyHash: text("api_key_hash"), // null for web_browser — uses session auth
  capabilities: jsonb("capabilities").notNull().default({}),
  hardwareVersion: text("hardware_version"),
  firmwareVersion: text("firmware_version"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  loopState: jsonb("loop_state"), // live loop engine state published by Pi
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// SAMPLE LIBRARY DOMAIN
// ============================================================================

export const samples = pgTable("samples", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id), // null = system sample
  /** User-entered display name from the sample editor metadata panel. */
  title: text("title"),
  blobUrl: text("blob_url").notNull(), // WAV file in Vercel Blob
  mp3BlobUrl: text("mp3_blob_url"), // compressed for browser playback (v0.2)
  waveformPeaks: jsonb("waveform_peaks"), // 200-point peak array for WaveSurfer
  durationSec: real("duration_sec").notNull(),
  sampleRate: integer("sample_rate").notNull(),
  rootNote: text("root_note"),
  rootFreq: real("root_freq"),
  brightness: smallint("brightness"), // 1-10
  attack: smallint("attack"), // 1-10
  sustain: smallint("sustain"), // 1-10
  texture: smallint("texture"), // 1-10
  warmth: smallint("warmth"), // 1-10
  category: sampleCategoryEnum("category"),
  family: sampleFamilyEnum("family"),
  loopable: boolean("loopable").notNull().default(false),
  verified: boolean("verified").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  /** Source sample this was edited from (sample-editor lineage, null for originals). */
  sourceSampleId: text("source_sample_id"),
  /** Effect-chain spec from the sample editor, replayable on re-open. */
  editSpec: jsonb("edit_spec"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sampleVibes = pgTable(
  "sample_vibes",
  {
    sampleId: text("sample_id")
      .notNull()
      .references(() => samples.id, { onDelete: "cascade" }),
    vibe: text("vibe").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sampleId, t.vibe] })]
);

export const sampleUserData = pgTable(
  "sample_user_data",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    sampleId: text("sample_id")
      .notNull()
      .references(() => samples.id),
    userRating: smallint("user_rating"), // 1-5
    isFavorite: boolean("is_favorite").notNull().default(false),
    timesUsed: integer("times_used").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sampleId] })]
);

export const kits = pgTable("kits", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id), // null = system kit
  name: text("name").notNull(),
  description: text("description"),
  triggers: jsonb("triggers").notNull().default([]), // string[]
  vibes: jsonb("vibes").notNull().default([]), // string[]
  slots: jsonb("slots").notNull().default({}), // slot definitions
  keyboardMap: jsonb("keyboard_map").default({}),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// RECORDING / LOOPER DOMAIN
// ============================================================================

export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  deviceId: uuid("device_id").references(() => devices.id),
  title: text("title"),
  blobUrl: text("blob_url").notNull(), // mixed-down audio
  durationSec: real("duration_sec").notNull(),
  sampleRate: integer("sample_rate").notNull().default(44100),
  bpm: integer("bpm"),
  kitId: text("kit_id").references(() => kits.id),
  waveformPeaks: jsonb("waveform_peaks"), // 200-point peak array for WaveSurfer
  // Groups stems + master from one looper session (also reused by transcription).
  sessionId: uuid("session_id"),
  recordingType: text("recording_type").notNull().default("upload"), // 'upload' | 'stem' | 'master' | 'transcription_session'
  isPublic: boolean("is_public").notNull().default(false),
  // Transcription-session fields (null for non-transcription recordings).
  parserVersion: integer("parser_version"),
  eventCount: integer("event_count"),
  firmwareVersion: text("firmware_version"),
  transcriptionStatus: text("transcription_status"), // 'parsing' | 'parsed' | 'rendered' | 'partial' | 'failed'
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loopTracks = pgTable("loop_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordingId: uuid("recording_id")
    .notNull()
    .references(() => recordings.id, { onDelete: "cascade" }),
  trackNumber: smallint("track_number").notNull(), // 1-6
  blobUrl: text("blob_url").notNull(),
  durationSec: real("duration_sec").notNull(),
  bpm: integer("bpm"),
  loopBars: integer("loop_bars"),
  sourceSampleId: text("source_sample_id").references(() => samples.id),
  state: trackStateEnum("state").notNull().default("empty"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// TRANSCRIPTION DOMAIN (Ocarina → Sheet Music)
// ============================================================================

/**
 * Raw event stream for a transcription session — one row per session, events as
 * a JSONB array. Written once and read as a batch by the derivation function, so
 * a single blob beats row-per-event (~18k rows/session for a query pattern that
 * doesn't exist). `session_id` is the parent `recordings.id`.
 */
export const transcriptionEvents = pgTable("transcription_events", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => recordings.id, { onDelete: "cascade" }),
  eventsJsonb: jsonb("events_jsonb").notNull(), // OcarinaEvent[]
  headerJsonb: jsonb("header_jsonb").notNull(), // OcarinaHeader
  parserVersion: integer("parser_version").notNull(),
  parsedAt: timestamp("parsed_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cached derivations. Keyed by a hash of the canonicalized interpretation
 * params + parser version, so a parser bump invalidates stale renders. One row
 * per session is flagged `is_default` (the server-computed render on ingest).
 */
export const transcriptionRenders = pgTable(
  "transcription_renders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => recordings.id, { onDelete: "cascade" }),
    paramsHash: text("params_hash").notNull(), // sha256 of canonicalized params
    paramsJsonb: jsonb("params_jsonb").notNull(), // DeriveParams
    parserVersion: integer("parser_version").notNull(),
    notationJsonb: jsonb("notation_jsonb"), // DerivedNote[] + chapters
    musicxml: text("musicxml"),
    midiBlobUrl: text("midi_blob_url"), // lazy on first export
    pdfBlobUrl: text("pdf_blob_url"), // reserved; server PDF deferred past v1
    isDefault: boolean("is_default").notNull().default(false),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("transcription_renders_session_hash_parser_idx").on(
      t.sessionId,
      t.paramsHash,
      t.parserVersion,
    ),
    index("transcription_renders_session_default_idx").on(t.sessionId, t.isDefault),
  ],
);

/**
 * "This looks wrong" feedback on a transcription (doc §6.1/§6.7). Freeform user
 * note + a snapshot of the params at report time — support, debugging, and
 * training data for a future AI cleanup pass.
 */
export const transcriptionFeedback = pgTable(
  "transcription_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => recordings.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    message: text("message").notNull(),
    paramsJsonb: jsonb("params_jsonb"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("transcription_feedback_session_idx").on(t.sessionId)],
);

// ============================================================================
// ACTIVITY DOMAIN
// ============================================================================

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  deviceId: uuid("device_id").references(() => devices.id),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSec: real("duration_sec"),
  kitId: text("kit_id").references(() => kits.id),
  samplesPlayed: integer("samples_played").notNull().default(0),
  loopsRecorded: integer("loops_recorded").notNull().default(0),
  vibesUsed: jsonb("vibes_used").notNull().default([]),
  mode: sessionModeEnum("mode").notNull().default("instrument"),
  metadata: jsonb("metadata").default({}),
});

/**
 * One row per saved /monitor capture session. Events themselves live in a
 * Vercel Blob JSON file referenced by `blobUrl` (pathname kept separately so
 * we can `del()` the blob when the row is deleted). Counts are denormalized
 * for the list view — saves having to fetch the blob just to render
 * "12 buttons · 38 notes".
 */
export const monitorCaptures = pgTable("monitor_captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  /** 'pi_rest' | 'realtime' | 'webserial' — kept as text since we may add more sources. */
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  durationMs: integer("duration_ms").notNull(),
  eventCount: integer("event_count").notNull().default(0),
  buttonEventCount: integer("button_event_count").notNull().default(0),
  noteEventCount: integer("note_event_count").notNull().default(0),
  fxEventCount: integer("fx_event_count").notNull().default(0),
  heartbeatCount: integer("heartbeat_count").notNull().default(0),
  loopEventCount: integer("loop_event_count").notNull().default(0),
  gpioEventCount: integer("gpio_event_count").notNull().default(0),
  miscEventCount: integer("misc_event_count").notNull().default(0),
  /** Free-text annotation the user attaches after the fact. */
  notes: text("notes"),
  /** When true, anyone with `shareToken` can replay the capture read-only. */
  isPublic: boolean("is_public").notNull().default(false),
  /** URL-safe random string. Unique when present (partial unique index). */
  shareToken: text("share_token"),
  /** Inline activity-heatmap SVG persisted to Blob at save time. */
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** One row per comment on a capture. RLS: read on owned + public; write requires auth. */
export const captureComments = pgTable("capture_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  captureId: uuid("capture_id")
    .notNull()
    .references(() => monitorCaptures.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// KARAOKE DOMAIN
// ============================================================================

export const karaokeSongs = pgTable("karaoke_songs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  decade: text("decade"),
  genre: jsonb("genre").notNull().default([]),
  tags: jsonb("tags").notNull().default([]),
  durationSec: integer("duration_sec"),
  key: text("key"),
  source: karaokeSourceEnum("source").notNull().default("midi"),
  available: boolean("available").notNull().default(false),
  midiBlobUrl: text("midi_blob_url"),
  wavBlobUrl: text("wav_blob_url"),
});

export const karaokeLyrics = pgTable("karaoke_lyrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  songId: text("song_id")
    .notNull()
    .references(() => karaokeSongs.id),
  contributedBy: uuid("contributed_by").references(() => users.id),
  lines: jsonb("lines").notNull().default([]), // { time_sec: number, text: string }[]
  source: lyricsSourceEnum("source").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const karaokeUserData = pgTable(
  "karaoke_user_data",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    songId: text("song_id")
      .notNull()
      .references(() => karaokeSongs.id),
    isFavorite: boolean("is_favorite").notNull().default(false),
    preferredPitchOffset: smallint("preferred_pitch_offset")
      .notNull()
      .default(0),
    timesPlayed: integer("times_played").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.songId] })]
);

// ============================================================================
// SYNC INFRASTRUCTURE
// ============================================================================

export const syncQueue = pgTable("sync_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id")
    .notNull()
    .references(() => devices.id),
  fileType: syncFileTypeEnum("file_type").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  blobUrl: text("blob_url"),
  status: syncStatusEnum("status").notNull().default("pending"),
  retryCount: smallint("retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const deviceConfigs = pgTable("device_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id")
    .notNull()
    .references(() => devices.id),
  configYaml: text("config_yaml").notNull(),
  configJson: jsonb("config_json").notNull(),
  version: integer("version").notNull().default(1),
  source: configSourceEnum("source").notNull().default("device"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// DEVICE PAIRING (unpaired Pi <-> cloud <-> user's webapp session)
// ============================================================================
// Lifecycle: Pi POSTs /pair/announce → row created with pairing_code.
// User types code on /devices → /pair/claim creates a `devices` row and writes
// the raw API key onto this row (claimed_raw_key) for one-shot retrieval.
// Pi polls /pair/poll → key returned exactly once and nulled on the row.
export const devicePairings = pgTable("device_pairings", {
  id: uuid("id").primaryKey().defaultRandom(),
  pairingCode: text("pairing_code").notNull().unique(), // 6-digit numeric, displayed as XXX-XXX
  deviceFingerprint: text("device_fingerprint").notNull(), // stable per-Pi identifier (e.g. machine-id hash)
  nameHint: text("name_hint"), // optional suggested name from Pi (e.g. hostname)
  hardwareVersion: text("hardware_version"),
  announceIp: text("announce_ip"), // public IP of the Pi when announcing; used for "Nearby" matching
  deviceId: uuid("device_id").references(() => devices.id), // populated on claim
  claimedRawKey: text("claimed_raw_key"), // plaintext, one-shot — cleared after Pi polls it
  claimAttempts: smallint("claim_attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// DEVICE COMMANDS (web → Pi, Pi polls)
// ============================================================================
export const deviceCommands = pgTable("device_commands", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id")
    .notNull()
    .references(() => devices.id),
  command: text("command").notNull(),  // e.g. "mute_track", "unmute_track", "stop_all"
  params: jsonb("params").default({}), // e.g. { track: 2 }
  status: text("status").notNull().default("pending"), // pending | consumed
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});
