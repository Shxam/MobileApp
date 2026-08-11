-- Phase 8 — celebrations become real bookings.
--
-- The party flow existed only in the browser: `AppContext.addCelebrationBooking`
-- fabricated an id, pushed it into React state and wrote it to localStorage, so
-- the dhaba never learned that a celebration had been sold and the customer lost
-- the booking when they cleared their browser.
--
-- Written with IF NOT EXISTS throughout, matching the style of the earlier
-- migrations, so it is safe against a database that already drifted ahead.

CREATE TABLE IF NOT EXISTS "celebration_bookings" (
  "id"               TEXT NOT NULL,
  "bookingNumber"    TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "packageId"        TEXT NOT NULL,

  "eventDate"        TIMESTAMP(3) NOT NULL,
  "timeSlot"         TEXT NOT NULL,
  "guestCount"       INTEGER NOT NULL,
  "turfName"         TEXT NOT NULL DEFAULT '',

  "decorTheme"       TEXT NOT NULL DEFAULT '',
  "commentarySetup"  BOOLEAN NOT NULL DEFAULT false,
  "trophyPackage"    BOOLEAN NOT NULL DEFAULT false,
  "specialFoodMenu"  BOOLEAN NOT NULL DEFAULT false,
  "cakeKg"           INTEGER NOT NULL DEFAULT 0,

  "basePricePaise"   INTEGER NOT NULL,
  "addonsPaise"      INTEGER NOT NULL DEFAULT 0,
  "subtotalPaise"    INTEGER NOT NULL,
  "gstAmountPaise"   INTEGER NOT NULL DEFAULT 0,
  "totalAmountPaise" INTEGER NOT NULL,

  "status"           "BookingStatus" NOT NULL DEFAULT 'confirmed',
  "paymentMethod"    "PaymentMethod" NOT NULL DEFAULT 'wallet',
  "paymentStatus"    "PaymentStatus" NOT NULL DEFAULT 'pending',
  "cancelledAt"      TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "celebration_bookings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "celebration_bookings_bookingNumber_key" ON "celebration_bookings"("bookingNumber");
CREATE INDEX        IF NOT EXISTS "celebration_bookings_userId_idx"        ON "celebration_bookings"("userId");
CREATE INDEX        IF NOT EXISTS "celebration_bookings_packageId_idx"     ON "celebration_bookings"("packageId");
CREATE INDEX        IF NOT EXISTS "celebration_bookings_status_idx"        ON "celebration_bookings"("status");
CREATE INDEX        IF NOT EXISTS "celebration_bookings_eventDate_idx"     ON "celebration_bookings"("eventDate");

DO $$ BEGIN
  ALTER TABLE "celebration_bookings" ADD CONSTRAINT "celebration_bookings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RESTRICT rather than CASCADE: retiring a package from the menu must not erase
-- the parties already sold under it.
DO $$ BEGIN
  ALTER TABLE "celebration_bookings" ADD CONSTRAINT "celebration_bookings_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "celebration_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
