CREATE TYPE "public"."BookingStatus" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('OWNER', 'MANAGER', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."SessionRevokedReason" AS ENUM('rotated', 'logout', 'compromised', 'admin');--> statement-breakpoint
CREATE TYPE "public"."VerificationType" AS ENUM('EMAIL_VERIFY', 'PASSWORD_RESET', 'MAGIC_LINK', 'TOTP_SETUP');--> statement-breakpoint
CREATE TABLE "Booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"staffId" uuid NOT NULL,
	"customerName" text NOT NULL,
	"customerEmail" text,
	"status" "BookingStatus" DEFAULT 'PENDING' NOT NULL,
	"startUtc" timestamp with time zone NOT NULL,
	"endUtc" timestamp with time zone NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Business" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"businessId" uuid NOT NULL,
	"role" "Role" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Service" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"priceCents" integer DEFAULT 0 NOT NULL,
	"durationMin" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"userAgent" text,
	"ip" text,
	"refreshTokenHash" text NOT NULL,
	"revokedAt" timestamp with time zone,
	"revokedReason" "SessionRevokedReason",
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" uuid NOT NULL,
	"userId" uuid,
	"name" text NOT NULL,
	"email" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"emailVerifiedAt" timestamp with time zone,
	"passwordHash" text,
	"twoFactorSecret" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "VerificationToken" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"type" "VerificationType" NOT NULL,
	"tokenHash" text NOT NULL,
	"sentTo" text,
	"meta" text,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "VerificationToken_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_Business_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_Service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffId_Staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_Business_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_Business_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_businessId_Business_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_business_idx" ON "Booking" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "booking_staff_time_idx" ON "Booking" USING btree ("staffId","startUtc","endUtc");--> statement-breakpoint
CREATE UNIQUE INDEX "business_slug_uq" ON "Business" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_user_business_uq" ON "Membership" USING btree ("userId","businessId");--> statement-breakpoint
CREATE INDEX "membership_user_idx" ON "Membership" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "membership_business_idx" ON "Membership" USING btree ("businessId");--> statement-breakpoint
CREATE UNIQUE INDEX "service_business_slug_uq" ON "Service" USING btree ("businessId","slug");--> statement-breakpoint
CREATE INDEX "service_business_idx" ON "Service" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "Session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_active_idx" ON "Session" USING btree ("userId","expiresAt");--> statement-breakpoint
CREATE INDEX "staff_business_idx" ON "Staff" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "staff_email_idx" ON "Staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_type_idx" ON "VerificationToken" USING btree ("type");--> statement-breakpoint
CREATE INDEX "verification_user_idx" ON "VerificationToken" USING btree ("userId");