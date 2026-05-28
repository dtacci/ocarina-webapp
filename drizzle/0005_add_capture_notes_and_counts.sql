ALTER TABLE "monitor_captures" ADD COLUMN "notes" text;
--> statement-breakpoint
ALTER TABLE "monitor_captures" ADD COLUMN "loop_event_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "monitor_captures" ADD COLUMN "gpio_event_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "monitor_captures" ADD COLUMN "misc_event_count" integer DEFAULT 0 NOT NULL;
