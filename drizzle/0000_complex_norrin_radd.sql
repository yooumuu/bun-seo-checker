CREATE TABLE "examples" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "link_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"internal_links" integer DEFAULT 0,
	"external_links" integer DEFAULT 0,
	"utm_params" jsonb,
	"broken_links" integer DEFAULT 0,
	"redirects" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "scan_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_url" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pages_total" integer DEFAULT 0,
	"pages_finished" integer DEFAULT 0,
	"issues_summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "scan_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"http_status" integer,
	"load_time_ms" integer,
	"issue_counts" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"title" text,
	"meta_description" text,
	"canonical" text,
	"h1" text,
	"robots_txt_blocked" boolean DEFAULT false,
	"schema_org" jsonb,
	"score" integer
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"element" text,
	"trigger" text,
	"platform" text,
	"status" text
);
--> statement-breakpoint
ALTER TABLE "link_metrics" ADD CONSTRAINT "link_metrics_page_id_scan_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."scan_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_pages" ADD CONSTRAINT "scan_pages_job_id_scan_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_metrics" ADD CONSTRAINT "seo_metrics_page_id_scan_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."scan_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_job_id_scan_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_page_id_scan_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."scan_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_metrics_page_id_idx" ON "link_metrics" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "scan_pages_job_id_idx" ON "scan_pages" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "seo_metrics_page_id_idx" ON "seo_metrics" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "task_events_job_id_idx" ON "task_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "tracking_events_page_id_idx" ON "tracking_events" USING btree ("page_id");