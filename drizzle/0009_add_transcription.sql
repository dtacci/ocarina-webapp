-- Transcription / sheet-music feature (Phase 1).
-- Extends `recordings` with transcription-session columns and adds two tables:
-- raw events (one blob per session) and cached derivations (renders).

-- Allow the new recording_type value (the existing CHECK only permitted audio types).
ALTER TABLE "recordings" DROP CONSTRAINT IF EXISTS "recordings_recording_type_check";--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_recording_type_check" CHECK (recording_type = ANY (ARRAY['upload'::text, 'stem'::text, 'master'::text, 'transcription_session'::text]));--> statement-breakpoint

ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "parser_version" integer;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "event_count" integer;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "firmware_version" text;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "transcription_status" text;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "transcription_events" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"events_jsonb" jsonb NOT NULL,
	"header_jsonb" jsonb NOT NULL,
	"parser_version" integer NOT NULL,
	"parsed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "transcription_renders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"params_hash" text NOT NULL,
	"params_jsonb" jsonb NOT NULL,
	"parser_version" integer NOT NULL,
	"notation_jsonb" jsonb,
	"musicxml" text,
	"midi_blob_url" text,
	"pdf_blob_url" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "transcription_events" ADD CONSTRAINT "transcription_events_session_id_recordings_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_renders" ADD CONSTRAINT "transcription_renders_session_id_recordings_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "transcription_renders_session_hash_parser_idx" ON "transcription_renders" ("session_id","params_hash","parser_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transcription_renders_session_default_idx" ON "transcription_renders" ("session_id","is_default");--> statement-breakpoint

-- RLS mirrors monitor_captures: owner access via a join to the parent recording.
-- The public SELECT path (shared sheet music) goes through the service-role
-- admin client, as listPublicRecordings does, so anon reads don't need a policy.
ALTER TABLE "transcription_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transcription_renders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "transcription_events_owner_all" ON "transcription_events" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM recordings r WHERE r.id = transcription_events.session_id AND r.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM recordings r WHERE r.id = transcription_events.session_id AND r.user_id = auth.uid()));--> statement-breakpoint

CREATE POLICY "transcription_renders_owner_all" ON "transcription_renders" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM recordings r WHERE r.id = transcription_renders.session_id AND r.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM recordings r WHERE r.id = transcription_renders.session_id AND r.user_id = auth.uid()));--> statement-breakpoint

CREATE POLICY "transcription_renders_public_select" ON "transcription_renders" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM recordings r WHERE r.id = transcription_renders.session_id AND r.is_public = true));
