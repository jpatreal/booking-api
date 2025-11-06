DROP INDEX "staff_availability_block_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "staff_availability_day_uq" ON "StaffAvailability" USING btree ("staffId","dayOfWeek");