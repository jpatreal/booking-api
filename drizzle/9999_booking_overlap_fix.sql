CREATE EXTENSION IF NOT EXISTS btree_gist;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_time_ck'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT booking_time_ck CHECK ("startUtc" < "endUtc");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_no_overlap'
  ) THEN
    ALTER TABLE "Booking" DROP CONSTRAINT booking_no_overlap;
  END IF;
END $$;

ALTER TABLE "Booking" DROP COLUMN IF EXISTS "timeRange";
DROP INDEX IF EXISTS booking_time_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_no_overlap_active'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT booking_no_overlap_active
      EXCLUDE USING gist (
        "staffId" WITH =,
        tstzrange("startUtc","endUtc",'[)') WITH &&
      )
      WHERE ("status" IN ('PENDING', 'CONFIRMED'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'booking_staff_time_idx'
  ) THEN
    CREATE INDEX booking_staff_time_idx ON "Booking" ("staffId", "startUtc", "endUtc");
  END IF;
END $$;

