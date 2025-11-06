ALTER TABLE "Booking"
ADD COLUMN "timeRange" tstzrange
  GENERATED ALWAYS AS (tstzrange("startUtc","endUtc",'[)')) STORED;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS booking_time_gist
  ON "Booking" USING gist ("staffId", "timeRange");

ALTER TABLE "Booking"
ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist ("staffId" WITH =, "timeRange" WITH &&);
