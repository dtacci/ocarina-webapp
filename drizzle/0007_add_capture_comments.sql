CREATE TABLE "capture_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capture_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capture_comments" ADD CONSTRAINT "capture_comments_capture_id_monitor_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."monitor_captures"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "capture_comments" ADD CONSTRAINT "capture_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "capture_comments_capture_created_idx" ON "capture_comments" ("capture_id", "created_at" DESC);
--> statement-breakpoint
ALTER TABLE "capture_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "capture_comments_select" ON "capture_comments" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM monitor_captures mc WHERE mc.id = capture_comments.capture_id AND (mc.user_id = auth.uid() OR mc.is_public = true)));
--> statement-breakpoint
CREATE POLICY "capture_comments_insert" ON "capture_comments" FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM monitor_captures mc WHERE mc.id = capture_comments.capture_id AND (mc.user_id = auth.uid() OR mc.is_public = true)));
--> statement-breakpoint
CREATE POLICY "capture_comments_delete" ON "capture_comments" FOR DELETE TO authenticated USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM monitor_captures mc WHERE mc.id = capture_comments.capture_id AND mc.user_id = auth.uid()));
