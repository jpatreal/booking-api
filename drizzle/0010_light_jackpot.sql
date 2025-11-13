ALTER TABLE "Business" ADD COLUMN "contactJson" jsonb;--> statement-breakpoint
CREATE INDEX "booking_business_time_idx" ON "Booking" USING btree ("businessId","startUtc");