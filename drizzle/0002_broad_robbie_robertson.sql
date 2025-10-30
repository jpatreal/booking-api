CREATE TABLE "StaffAvailability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"staffId" uuid NOT NULL,
	"dayOfWeek" smallint NOT NULL,
	"startTimeLocal" time NOT NULL,
	"endTimeLocal" time NOT NULL,
	CONSTRAINT "staff_availability_day_ck" CHECK ("StaffAvailability"."dayOfWeek" >= 0 AND "StaffAvailability"."dayOfWeek" <= 6),
	CONSTRAINT "staff_availability_time_ck" CHECK ("StaffAvailability"."startTimeLocal" < "StaffAvailability"."endTimeLocal")
);
--> statement-breakpoint
CREATE TABLE "StaffService" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"staffId" uuid NOT NULL,
	"serviceId" uuid NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"priceCentsOverride" integer,
	"durationMinOverride" integer,
	"bufferBeforeMin" integer DEFAULT 0 NOT NULL,
	"bufferAfterMin" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StaffTimeOff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"staffId" uuid NOT NULL,
	"startUtc" timestamp with time zone NOT NULL,
	"endUtc" timestamp with time zone NOT NULL,
	"reason" text,
	CONSTRAINT "staff_timeoff_range_ck" CHECK ("StaffTimeOff"."startUtc" < "StaffTimeOff"."endUtc")
);
--> statement-breakpoint
DROP INDEX "staff_email_idx";--> statement-breakpoint
ALTER TABLE "Business" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "Staff" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "Staff" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "Staff" ADD COLUMN "imageUrl" text;--> statement-breakpoint
ALTER TABLE "Staff" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "Staff" ADD COLUMN "displayOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_staffId_Staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_staffId_Staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_serviceId_Service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_staffId_Staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_availability_staff_idx" ON "StaffAvailability" USING btree ("staffId");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_availability_day_uq" ON "StaffAvailability" USING btree ("staffId","dayOfWeek");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_service_uq" ON "StaffService" USING btree ("staffId","serviceId");--> statement-breakpoint
CREATE INDEX "staff_service_staff_idx" ON "StaffService" USING btree ("staffId");--> statement-breakpoint
CREATE INDEX "staff_service_service_idx" ON "StaffService" USING btree ("serviceId");--> statement-breakpoint
CREATE INDEX "staff_timeoff_staff_idx" ON "StaffTimeOff" USING btree ("staffId");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_business_email_uq" ON "Staff" USING btree ("businessId","email");--> statement-breakpoint
CREATE INDEX "staff_user_idx" ON "Staff" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_business_user_uq" ON "Staff" USING btree ("businessId","userId");