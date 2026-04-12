CREATE TYPE "public"."config_source" AS ENUM('device', 'web', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('pi_pro', 'web_browser', 'mobile_app', 'arduino_lite');--> statement-breakpoint
CREATE TYPE "public"."karaoke_source" AS ENUM('midi', 'wav', 'both');--> statement-breakpoint
CREATE TYPE "public"."lyrics_source" AS ENUM('midi_embedded', 'user_contributed', 'auto_generated');--> statement-breakpoint
CREATE TYPE "public"."sample_category" AS ENUM('acoustic', 'percussion', 'fx');--> statement-breakpoint
CREATE TYPE "public"."sample_family" AS ENUM('strings', 'brass', 'woodwind', 'keys', 'mallet', 'drums', 'guitar', 'other_perc', 'other', 'fx');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('instrument', 'karaoke', 'madlibs', 'looper');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."sync_file_type" AS ENUM('recording', 'config', 'sample', 'session');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'uploading', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('free', 'plus', 'studio');--> statement-breakpoint
CREATE TYPE "public"."track_state" AS ENUM('empty', 'recorded', 'muted');--> statement-breakpoint
CREATE TABLE "device_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"config_yaml" text NOT NULL,
	"config_json" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"source" "config_source" DEFAULT 'device' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"device_type" "device_type" NOT NULL,
	"api_key_hash" text,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hardware_version" text,
	"firmware_version" text,
	"last_seen_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "karaoke_lyrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" text NOT NULL,
	"contributed_by" uuid,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "lyrics_source" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "karaoke_songs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"decade" text,
	"genre" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_sec" integer,
	"key" text,
	"source" "karaoke_source" DEFAULT 'midi' NOT NULL,
	"available" boolean DEFAULT false NOT NULL,
	"midi_blob_url" text,
	"wav_blob_url" text
);
--> statement-breakpoint
CREATE TABLE "karaoke_user_data" (
	"user_id" uuid NOT NULL,
	"song_id" text NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"preferred_pitch_offset" smallint DEFAULT 0 NOT NULL,
	"times_played" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "karaoke_user_data_user_id_song_id_pk" PRIMARY KEY("user_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "kits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vibes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"slots" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"keyboard_map" jsonb DEFAULT '{}'::jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loop_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"track_number" smallint NOT NULL,
	"blob_url" text NOT NULL,
	"duration_sec" real NOT NULL,
	"bpm" integer,
	"loop_bars" integer,
	"source_sample_id" text,
	"state" "track_state" DEFAULT 'empty' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"title" text,
	"blob_url" text NOT NULL,
	"duration_sec" real NOT NULL,
	"sample_rate" integer DEFAULT 44100 NOT NULL,
	"bpm" integer,
	"kit_id" text,
	"waveform_peaks" jsonb,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sample_user_data" (
	"user_id" uuid NOT NULL,
	"sample_id" text NOT NULL,
	"user_rating" smallint,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"times_used" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "sample_user_data_user_id_sample_id_pk" PRIMARY KEY("user_id","sample_id")
);
--> statement-breakpoint
CREATE TABLE "sample_vibes" (
	"sample_id" text NOT NULL,
	"vibe" text NOT NULL,
	CONSTRAINT "sample_vibes_sample_id_vibe_pk" PRIMARY KEY("sample_id","vibe")
);
--> statement-breakpoint
CREATE TABLE "samples" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"blob_url" text NOT NULL,
	"mp3_blob_url" text,
	"waveform_peaks" jsonb,
	"duration_sec" real NOT NULL,
	"sample_rate" integer NOT NULL,
	"root_note" text,
	"root_freq" real,
	"brightness" smallint,
	"attack" smallint,
	"sustain" smallint,
	"texture" smallint,
	"warmth" smallint,
	"category" "sample_category",
	"family" "sample_family",
	"loopable" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_sec" real,
	"kit_id" text,
	"samples_played" integer DEFAULT 0 NOT NULL,
	"loops_recorded" integer DEFAULT 0 NOT NULL,
	"vibes_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mode" "session_mode" DEFAULT 'instrument' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"file_type" "sync_file_type" NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"blob_url" text,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" "tier" NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"status" "subscription_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"tier" "tier" DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_configs" ADD CONSTRAINT "device_configs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karaoke_lyrics" ADD CONSTRAINT "karaoke_lyrics_song_id_karaoke_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."karaoke_songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karaoke_lyrics" ADD CONSTRAINT "karaoke_lyrics_contributed_by_users_id_fk" FOREIGN KEY ("contributed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karaoke_user_data" ADD CONSTRAINT "karaoke_user_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karaoke_user_data" ADD CONSTRAINT "karaoke_user_data_song_id_karaoke_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."karaoke_songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kits" ADD CONSTRAINT "kits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_tracks" ADD CONSTRAINT "loop_tracks_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_tracks" ADD CONSTRAINT "loop_tracks_source_sample_id_samples_id_fk" FOREIGN KEY ("source_sample_id") REFERENCES "public"."samples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_user_data" ADD CONSTRAINT "sample_user_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_user_data" ADD CONSTRAINT "sample_user_data_sample_id_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."samples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_vibes" ADD CONSTRAINT "sample_vibes_sample_id_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "samples" ADD CONSTRAINT "samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;