ALTER TABLE "monitor_captures" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "monitor_captures" ADD COLUMN "share_token" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "monitor_captures_share_token_idx" ON "monitor_captures" ("share_token") WHERE "share_token" IS NOT NULL;
