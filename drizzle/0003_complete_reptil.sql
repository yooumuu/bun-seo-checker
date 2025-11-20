ALTER TABLE "scan_pages" ADD COLUMN "device_variant" text DEFAULT 'desktop';--> statement-breakpoint
ALTER TABLE "tracking_events" ADD COLUMN "device_variant" text DEFAULT 'desktop';--> statement-breakpoint
ALTER TABLE "tracking_events" ADD COLUMN "payload" jsonb;