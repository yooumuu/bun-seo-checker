ALTER TABLE "seo_metrics" ADD COLUMN "json_ld_score" integer;--> statement-breakpoint
ALTER TABLE "seo_metrics" ADD COLUMN "json_ld_types" text[];--> statement-breakpoint
ALTER TABLE "seo_metrics" ADD COLUMN "json_ld_issues" jsonb;--> statement-breakpoint
ALTER TABLE "seo_metrics" ADD COLUMN "html_structure_score" integer;--> statement-breakpoint
ALTER TABLE "seo_metrics" ADD COLUMN "html_structure_issues" jsonb;