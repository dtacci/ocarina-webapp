-- "This looks wrong" feedback on a transcription session (doc §6.1/§6.7).
-- Captures freeform user feedback + the params snapshot for later debugging /
-- an ML cleanup pass. Owner-scoped via user_id.

CREATE TABLE IF NOT EXISTS "transcription_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"params_jsonb" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "transcription_feedback" ADD CONSTRAINT "transcription_feedback_session_id_recordings_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transcription_feedback_session_idx" ON "transcription_feedback" ("session_id");--> statement-breakpoint

ALTER TABLE "transcription_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "transcription_feedback_owner_all" ON "transcription_feedback" FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
