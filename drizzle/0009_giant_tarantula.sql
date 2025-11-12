ALTER TABLE "Business" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Manila';--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "logoUrl" text;--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "primaryColor" varchar(9) DEFAULT '#3b82f6' NOT NULL;--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "tagline" text DEFAULT 'Book your appointment in seconds.';--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "addressJson" jsonb;--> statement-breakpoint
ALTER TABLE "Business" ADD CONSTRAINT "biz_color_ck" CHECK ("Business"."primaryColor" ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');