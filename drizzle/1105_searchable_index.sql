CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS svc_name_trgm ON "Service" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS cust_name_trgm ON "Customer" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS cust_email_trgm ON "Customer" USING gin (email gin_trgm_ops);
