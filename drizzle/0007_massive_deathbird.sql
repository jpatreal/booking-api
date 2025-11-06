CREATE TABLE "AuditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" uuid,
	"actorUserId" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entityId" uuid NOT NULL,
	"meta" jsonb,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "Outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"processedAt" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DROP INDEX "staff_availability_day_uq";--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "bookedPriceCents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "bookedDurationMin" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "serviceSnapshotJson" jsonb;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "confirmedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "cancelledAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "cancelReason" text;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "noShowAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "source" text DEFAULT 'internal';--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "channelRef" text;--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "paymentStatus" text DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "depositCents" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "Customer" ADD COLUMN "phoneE164" text;--> statement-breakpoint
ALTER TABLE "Customer" ADD COLUMN "marketingOptInAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Customer" ADD COLUMN "tags" text;--> statement-breakpoint
ALTER TABLE "Service" ADD COLUMN "capacity" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "Service" ADD COLUMN "minLeadMinutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Service" ADD COLUMN "maxAdvanceDays" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "Service" ADD COLUMN "isPublic" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "StaffService" ADD COLUMN "isBookable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_Business_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_User_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_biz_idx" ON "AuditLog" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "AuditLog" USING btree ("entity","entityId");--> statement-breakpoint
CREATE INDEX "outbox_topic_idx" ON "Outbox" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "cust_biz_phone_idx" ON "Customer" USING btree ("businessId","phoneE164");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_availability_block_uq" ON "StaffAvailability" USING btree ("staffId","dayOfWeek","startTimeLocal");