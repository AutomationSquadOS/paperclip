ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "horizon" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "target_date" date;
