CREATE TABLE "device_pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pairing_code" text NOT NULL,
	"device_fingerprint" text NOT NULL,
	"name_hint" text,
	"hardware_version" text,
	"announce_ip" text,
	"device_id" uuid,
	"claimed_raw_key" text,
	"claim_attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_pairings_pairing_code_unique" UNIQUE("pairing_code")
);
--> statement-breakpoint
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "device_pairings_announce_ip_idx" ON "device_pairings" ("announce_ip", "expires_at");
--> statement-breakpoint
CREATE INDEX "device_pairings_fingerprint_idx" ON "device_pairings" ("device_fingerprint");
