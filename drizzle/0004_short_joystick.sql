CREATE TABLE "BookingStatusHistory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"bookingId" uuid NOT NULL,
	"fromStatus" "BookingStatus",
	"toStatus" "BookingStatus" NOT NULL,
	"changedByUserId" uuid,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "BusinessHours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"businessId" uuid NOT NULL,
	"dayOfWeek" smallint NOT NULL,
	"openTimeLocal" time NOT NULL,
	"closeTimeLocal" time NOT NULL,
	CONSTRAINT "biz_hours_day_ck" CHECK ("BusinessHours"."dayOfWeek" >= 0 AND "BusinessHours"."dayOfWeek" <= 6),
	CONSTRAINT "biz_hours_time_ck" CHECK ("BusinessHours"."openTimeLocal" < "BusinessHours"."closeTimeLocal")
);
--> statement-breakpoint
CREATE TABLE "Customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	"businessId" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "Booking" ADD COLUMN "customerId" uuid;--> statement-breakpoint
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_Booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_changedByUserId_User_id_fk" FOREIGN KEY ("changedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_businessId_Business_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_Business_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_hist_booking_idx" ON "BookingStatusHistory" USING btree ("bookingId");--> statement-breakpoint
CREATE UNIQUE INDEX "biz_hours_day_uq" ON "BusinessHours" USING btree ("businessId","dayOfWeek");--> statement-breakpoint
CREATE INDEX "cust_biz_idx" ON "Customer" USING btree ("businessId");--> statement-breakpoint
CREATE UNIQUE INDEX "cust_biz_email_uq" ON "Customer" USING btree ("businessId","email");--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_Customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_customer_idx" ON "Booking" USING btree ("customerId");