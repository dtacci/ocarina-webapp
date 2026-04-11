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
  isPublic: boolean("is_public").notNull().default(false),
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
