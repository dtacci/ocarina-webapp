-- Song catalog + ensemble-matcher cache for the "sounds-like" feature.
-- `songs` caches Deezer lookups (search/track metadata + the 30s preview url);
-- `isrc` is carried so a future Spotify full-track phase can match the same
-- recording. `song_ensembles` caches the expensive analysis (LLM profile +
-- matched library samples + optional drum groove) keyed by analysis_version so
-- an algorithm change invalidates cleanly. Reads are shared (library-style);
-- all writes flow through API routes via the service-role client.

-- ---------------------------------------------------------------------------
-- songs — external track catalog cache (Deezer; `source` seams in Spotify)
-- ---------------------------------------------------------------------------
CREATE TABLE "songs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'deezer' NOT NULL,
	"deezer_id" bigint,
	"isrc" text,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"album" text,
	"album_art_url" text,
	"preview_url" text,
	"duration_sec" integer,
	"deezer_bpm" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- One catalog row per external track; preview urls expire and get refreshed in place.
CREATE UNIQUE INDEX "songs_source_deezer_idx" ON "songs" ("source", "deezer_id") WHERE "deezer_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "songs_isrc_idx" ON "songs" ("isrc") WHERE "isrc" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "songs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Shared catalog: readable by any signed-in user; writes via service role only.
CREATE POLICY "songs_authenticated_select" ON "songs" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- song_ensembles — cached analysis: profile + matched library samples + drums
-- ---------------------------------------------------------------------------
CREATE TABLE "song_ensembles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" text NOT NULL,
	"user_id" uuid,
	"analysis_version" smallint DEFAULT 1 NOT NULL,
	"bpm" integer,
	"profile_jsonb" jsonb,
	"ensemble_jsonb" jsonb NOT NULL,
	"drum_jsonb" jsonb,
	"deep_analyzed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "song_ensembles" ADD CONSTRAINT "song_ensembles_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "song_ensembles" ADD CONSTRAINT "song_ensembles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- One cached analysis per song + algorithm version (shared library cache).
-- Plain (non-partial) so Supabase upsert onConflict can target it. user_id is
-- reserved for future per-user overrides; it stays NULL for the shared cache.
CREATE UNIQUE INDEX "song_ensembles_song_version_idx" ON "song_ensembles" ("song_id", "analysis_version");
--> statement-breakpoint
ALTER TABLE "song_ensembles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Shared analysis cache: readable by any signed-in user; writes via service role only.
CREATE POLICY "song_ensembles_authenticated_select" ON "song_ensembles" FOR SELECT TO authenticated USING (true);
