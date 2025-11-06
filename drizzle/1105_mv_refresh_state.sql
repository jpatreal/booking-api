CREATE TABLE IF NOT EXISTS mv_refresh_state (
  mv_name text PRIMARY KEY,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mv_refresh_state (mv_name) VALUES
  ('mv_booking_daily_status'),
  ('mv_service_90d'),
  ('mv_staff_utilization_daily'),
  ('mv_customer_first_booking')
ON CONFLICT (mv_name) DO NOTHING;
