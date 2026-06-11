-- ML data-flywheel scaffolding: unified interaction event log, sample
-- descriptions with provenance, model-versioned embeddings (pgvector), and
-- raw AI invocation logging. Plus per-user ML consent flags.
-- Event vocabulary + versioning rules: docs/EVENTS.md

CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "ml_consent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ml_consent_at" timestamp with time zone;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- interaction_events — append-only unified event log
-- ---------------------------------------------------------------------------
CREATE TABLE "interaction_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"session_id" uuid,
	"query_id" uuid,
	"event_type" text NOT NULL,
	"sample_id" text,
	"source" text NOT NULL,
	"client_ts" timestamp with time zone,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "interaction_events_user_created_idx" ON "interaction_events" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "interaction_events_type_created_idx" ON "interaction_events" ("event_type", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "interaction_events_query_idx" ON "interaction_events" ("query_id");
--> statement-breakpoint
CREATE INDEX "interaction_events_sample_idx" ON "interaction_events" ("sample_id") WHERE "sample_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "interaction_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Owner read-only; all writes flow through API routes via the service-role client.
CREATE POLICY "interaction_events_owner_select" ON "interaction_events" FOR SELECT TO authenticated USING (user_id = auth.uid());
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- sample_descriptions — provenance-tracked natural-language descriptions
-- ---------------------------------------------------------------------------
CREATE TABLE "sample_descriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sample_id" text NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"parent_description_id" uuid,
	"is_canonical" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sample_descriptions" ADD CONSTRAINT "sample_descriptions_sample_id_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."samples"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- One canonical, non-deleted description per sample.
CREATE UNIQUE INDEX "sample_descriptions_canonical_idx" ON "sample_descriptions" ("sample_id") WHERE "is_canonical" AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "sample_descriptions_sample_idx" ON "sample_descriptions" ("sample_id");
--> statement-breakpoint
ALTER TABLE "sample_descriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Shared library: readable by any signed-in user; writes via service role only.
CREATE POLICY "sample_descriptions_authenticated_select" ON "sample_descriptions" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- sample_embeddings — model-versioned derived vectors (pgvector)
-- ---------------------------------------------------------------------------
CREATE TABLE "sample_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sample_id" text NOT NULL,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(1536),
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sample_embeddings" ADD CONSTRAINT "sample_embeddings_sample_id_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."samples"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "sample_embeddings_sample_kind_model_idx" ON "sample_embeddings" ("sample_id", "kind", "model");
--> statement-breakpoint
CREATE INDEX "sample_embeddings_hnsw_idx" ON "sample_embeddings" USING hnsw ("embedding" vector_cosine_ops) WHERE "archived" = false;
--> statement-breakpoint
ALTER TABLE "sample_embeddings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sample_embeddings_authenticated_select" ON "sample_embeddings" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- ai_invocations — raw prompt/completion log for every AI feature
-- ---------------------------------------------------------------------------
CREATE TABLE "ai_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"request_jsonb" jsonb NOT NULL,
	"response_jsonb" jsonb,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_invocations_feature_created_idx" ON "ai_invocations" ("feature", "created_at" DESC);
--> statement-breakpoint
ALTER TABLE "ai_invocations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ai_invocations_owner_select" ON "ai_invocations" FOR SELECT TO authenticated USING (user_id = auth.uid());
