-- Phase 4 — wallet top-ups paid at the gateway.
--
-- A top-up cannot ride on the `payments` table: `payments.orderId` is a required
-- FK to an order, and a top-up buys wallet credit rather than an order. The
-- amount is fixed when the intent opens, so the capture credits what was quoted.

CREATE TABLE IF NOT EXISTS "wallet_topups" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "provider"          TEXT NOT NULL DEFAULT 'razorpay',
  "providerOrderId"   TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "amountPaise"       INTEGER NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'INR',
  "status"            "PaymentStatus" NOT NULL DEFAULT 'pending',
  "failureReason"     TEXT,
  "creditedAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_topups_pkey" PRIMARY KEY ("id")
);

-- Both unique constraints are load-bearing: providerOrderId dedupes intents,
-- providerPaymentId dedupes captures.
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_topups_providerOrderId_key"   ON "wallet_topups"("providerOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_topups_providerPaymentId_key" ON "wallet_topups"("providerPaymentId");
CREATE INDEX        IF NOT EXISTS "wallet_topups_userId_idx"            ON "wallet_topups"("userId");
CREATE INDEX        IF NOT EXISTS "wallet_topups_status_idx"            ON "wallet_topups"("status");

DO $$ BEGIN
  ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
