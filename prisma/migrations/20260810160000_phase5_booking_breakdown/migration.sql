-- Phase 5 — bookings gain a reference number, a money breakdown, and a payment method.
--
-- Previously a booking stored only `totalAmountPaise`, so the GST portion of a
-- turf booking could not be reported and a cancellation had nothing to refund
-- against. `bookingNumber` replaces showing the raw UUID at the gate.
--
-- Written with IF NOT EXISTS throughout so it is safe against a database that
-- already drifted ahead of the migration history.

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "bookingNumber"  TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "subtotalPaise"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "gstAmountPaise" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelledAt"    TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "bookings" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'wallet';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Backfill from the id so the unique index below can be created on existing
-- rows. New rows get a random reference from the application.
UPDATE "bookings"
   SET "bookingNumber" = 'TRF-' || UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 8))
 WHERE "bookingNumber" IS NULL;

-- Legacy rows carried no breakdown; treat the whole charge as the subtotal
-- rather than inventing a tax split that was never collected.
UPDATE "bookings" SET "subtotalPaise" = "totalAmountPaise" WHERE "subtotalPaise" = 0;

ALTER TABLE "bookings" ALTER COLUMN "bookingNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_bookingNumber_key" ON "bookings"("bookingNumber");
