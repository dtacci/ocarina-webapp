-- Track-editor mixes: one jsonb document per saved mix of a looper session's
-- stems (volume / pan / mute / solo / EffectNode[] chain per channel, plus a
-- master section). Same serialization pattern as samples.edit_spec. The
-- `arrangement` column is reserved for clip-arrangement (phase B). Owner-only.

CREATE TABLE IF NOT EXISTS "session_mixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'Mix' NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"master" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"arrangement" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "session_mixes" ADD CONSTRAINT "session_mixes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "session_mixes" ADD CONSTRAINT "session_mixes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "session_mixes_session_name_idx" ON "session_mixes" ("session_id", "name");--> statement-breakpoint

ALTER TABLE "session_mixes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "session_mixes_owner_all" ON "session_mixes" FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
