CREATE UNIQUE INDEX IF NOT EXISTS invite_pending_unique
ON "MembershipInvite" ("businessId","email")
WHERE "acceptedAt" IS NULL AND "expiresAt" > now();
