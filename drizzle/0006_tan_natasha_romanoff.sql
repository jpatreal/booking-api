CREATE TABLE "MembershipInvite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "Role" NOT NULL,
	"tokenHash" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"expiresAt" timestamp with time zone NOT NULL,
	"acceptedAt" timestamp with time zone,
	CONSTRAINT "MembershipInvite_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "MembershipInvite" ADD CONSTRAINT "MembershipInvite_businessId_Business_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_token_hash_uq" ON "MembershipInvite" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "invite_business_email_idx" ON "MembershipInvite" USING btree ("businessId","email");--> statement-breakpoint
CREATE INDEX "invite_business_expires_idx" ON "MembershipInvite" USING btree ("businessId","expiresAt");--> statement-breakpoint
CREATE INDEX "invite_business_accepted_idx" ON "MembershipInvite" USING btree ("businessId","acceptedAt");