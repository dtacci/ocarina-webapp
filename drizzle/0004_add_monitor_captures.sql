CREATE TABLE "monitor_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"name" text NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"button_event_count" integer DEFAULT 0 NOT NULL,
	"note_event_count" integer DEFAULT 0 NOT NULL,
	"fx_event_count" integer DEFAULT 0 NOT NULL,
	"heartbeat_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitor_captures" ADD CONSTRAINT "monitor_captures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "monitor_captures" ADD CONSTRAINT "monitor_captures_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "monitor_captures_user_created_idx" ON "monitor_captures" ("user_id", "created_at" DESC);
--> statement-breakpoint
ALTER TABLE "monitor_captures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "monitor_captures_owner_select" ON "monitor_captures" FOR SELECT TO authenticated USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "monitor_captures_owner_insert" ON "monitor_captures" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "monitor_captures_owner_update" ON "monitor_captures" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "monitor_captures_owner_delete" ON "monitor_captures" FOR DELETE TO authenticated USING (user_id = auth.uid());
