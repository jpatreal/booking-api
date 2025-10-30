CREATE TYPE "public"."Plan" AS ENUM('TEST', 'TRIAL', 'FREE', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."SubscriptionStatus" AS ENUM('trialing', 'active', 'past_due', 'suspended', 'canceled');--> statement-breakpoint
CREATE TABLE "SignupKey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"codeHash" text NOT NULL,
	"label" text,
	"plan" "Plan" DEFAULT 'TRIAL' NOT NULL,
	"trialDays" integer DEFAULT 14 NOT NULL,
	"maxUses" integer DEFAULT 1 NOT NULL,
	"usedCount" integer DEFAULT 0 NOT NULL,
	"emailDomain" text,
	"expiresAt" timestamp with time zone,
	"allowMultipleBusinessesPerUser" boolean DEFAULT true NOT NULL,
	CONSTRAINT "SignupKey_codeHash_unique" UNIQUE("codeHash")
);
--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "plan" "Plan" DEFAULT 'TRIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "status" "SubscriptionStatus" DEFAULT 'trialing' NOT NULL;--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "trialEndsAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "planRenewsAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "suspendedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "limitsJson" jsonb;--> statement-breakpoint
ALTER TABLE "Membership" ADD COLUMN "disabledAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "disabledAt" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "signup_key_expires_idx" ON "SignupKey" USING btree ("expiresAt");