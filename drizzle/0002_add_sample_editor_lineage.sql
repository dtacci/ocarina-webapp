ALTER TABLE "samples" ADD COLUMN "source_sample_id" text;--> statement-breakpoint
ALTER TABLE "samples" ADD COLUMN "edit_spec" jsonb;--> statement-breakpoint
ALTER TABLE "samples" ADD CONSTRAINT "samples_source_sample_id_samples_id_fk" FOREIGN KEY ("source_sample_id") REFERENCES "public"."samples"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "samples_source_sample_id_idx" ON "samples" ("source_sample_id");
