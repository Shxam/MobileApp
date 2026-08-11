-- ===================================================
-- Phase 2 — Data model
--
-- Written idempotently (IF NOT EXISTS / DO blocks) because the live database
-- drifted ahead of the migration history: users.firebaseUid, employeeId, pin
-- and dhabaId exist in production but in no migration. This must apply cleanly
-- both to a from-scratch database and to the drifted one.
--
-- MONEY: every money column becomes INTEGER paise. Conversion is
-- ROUND(col * 100) so existing float rupees carry over exactly.
-- ===================================================

-- ─── 1. Reconcile the schema/migration drift ────────

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firebaseUid" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employeeId"  TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pin"         TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dhabaId"     TEXT DEFAULT 'dhaba_singarayakonda';

CREATE UNIQUE INDEX IF NOT EXISTS "users_firebaseUid_key" ON "users"("firebaseUid");
CREATE UNIQUE INDEX IF NOT EXISTS "users_employeeId_key"  ON "users"("employeeId");
CREATE INDEX        IF NOT EXISTS "users_role_idx"        ON "users"("role");
CREATE INDEX        IF NOT EXISTS "users_dhabaId_idx"     ON "users"("dhabaId");

-- ─── 2. New enum types ──────────────────────────────
-- (New OrderStatus *values* were added in the preceding migration; Postgres
-- forbids using an enum value in the transaction that adds it.)

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM (
    'pending', 'cod_pending', 'paid', 'failed', 'refunded', 'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('razorpay', 'cod', 'wallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Money → integer paise ───────────────────────

-- menu_items.price → pricePaise
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "pricePaise" INTEGER;
UPDATE "menu_items" SET "pricePaise" = ROUND(COALESCE("price", 0) * 100)::int
  WHERE "pricePaise" IS NULL;
ALTER TABLE "menu_items" ALTER COLUMN "pricePaise" SET NOT NULL;
ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "price";

ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "nameHi"          TEXT;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "descriptionHi"   TEXT;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "prepTimeMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "dhabaId"         TEXT NOT NULL DEFAULT 'dhaba_singarayakonda';

CREATE INDEX IF NOT EXISTS "menu_items_dhabaId_idx"     ON "menu_items"("dhabaId");
CREATE INDEX IF NOT EXISTS "menu_items_category_idx"    ON "menu_items"("category");
CREATE INDEX IF NOT EXISTS "menu_items_isAvailable_idx" ON "menu_items"("isAvailable");

-- order_items.price → unitPricePaise
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unitPricePaise" INTEGER;
UPDATE "order_items" SET "unitPricePaise" = ROUND(COALESCE("price", 0) * 100)::int
  WHERE "unitPricePaise" IS NULL;
ALTER TABLE "order_items" ALTER COLUMN "unitPricePaise" SET NOT NULL;
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "price";
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "nameSnapshot" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "order_items_orderId_idx"    ON "order_items"("orderId");
CREATE INDEX IF NOT EXISTS "order_items_menuItemId_idx" ON "order_items"("menuItemId");

-- turf_slots.price → pricePaise
ALTER TABLE "turf_slots" ADD COLUMN IF NOT EXISTS "pricePaise" INTEGER;
UPDATE "turf_slots" SET "pricePaise" = ROUND(COALESCE("price", 0) * 100)::int
  WHERE "pricePaise" IS NULL;
ALTER TABLE "turf_slots" ALTER COLUMN "pricePaise" SET NOT NULL;
ALTER TABLE "turf_slots" DROP COLUMN IF EXISTS "price";
ALTER TABLE "turf_slots" ADD COLUMN IF NOT EXISTS "turfId"     TEXT;
ALTER TABLE "turf_slots" ADD COLUMN IF NOT EXISTS "isFloodlit" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "turf_slots_turfId_idx"    ON "turf_slots"("turfId");
CREATE INDEX IF NOT EXISTS "turf_slots_startTime_idx" ON "turf_slots"("startTime");
CREATE INDEX IF NOT EXISTS "turf_slots_isBooked_idx"  ON "turf_slots"("isBooked");

-- bookings.totalAmount → totalAmountPaise
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "totalAmountPaise" INTEGER;
UPDATE "bookings" SET "totalAmountPaise" = ROUND(COALESCE("totalAmount", 0) * 100)::int
  WHERE "totalAmountPaise" IS NULL;
ALTER TABLE "bookings" ALTER COLUMN "totalAmountPaise" SET NOT NULL;
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "totalAmount";
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS "bookings_userId_idx" ON "bookings"("userId");
CREATE INDEX IF NOT EXISTS "bookings_slotId_idx" ON "bookings"("slotId");
CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings"("status");

-- wallet_transactions.amount → amountPaise
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "amountPaise" INTEGER;
UPDATE "wallet_transactions" SET "amountPaise" = ROUND(ABS(COALESCE("amount", 0)) * 100)::int
  WHERE "amountPaise" IS NULL;
ALTER TABLE "wallet_transactions" ALTER COLUMN "amountPaise" SET NOT NULL;
ALTER TABLE "wallet_transactions" DROP COLUMN IF EXISTS "amount";
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "balanceAfterPaise" INTEGER;
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "walletId"    TEXT;
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "category"    TEXT NOT NULL DEFAULT 'topup';
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "referenceId" TEXT;

CREATE INDEX IF NOT EXISTS "wallet_transactions_userId_idx"    ON "wallet_transactions"("userId");
CREATE INDEX IF NOT EXISTS "wallet_transactions_walletId_idx"  ON "wallet_transactions"("walletId");
CREATE INDEX IF NOT EXISTS "wallet_transactions_createdAt_idx" ON "wallet_transactions"("createdAt");

-- ─── 4. Orders: money breakdown, payment, dispatch ───

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotalPaise"    INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "gstAmountPaise"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryFeePaise" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discountPaise"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "totalAmountPaise" INTEGER;

UPDATE "orders" SET "totalAmountPaise" = ROUND(COALESCE("totalAmount", 0) * 100)::int
  WHERE "totalAmountPaise" IS NULL;
-- Legacy rows carried no breakdown; treat the historical total as the subtotal.
UPDATE "orders" SET "subtotalPaise" = "totalAmountPaise" WHERE "subtotalPaise" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "totalAmountPaise" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "subtotalPaise"    SET NOT NULL;
ALTER TABLE "orders" DROP COLUMN IF EXISTS "totalAmount";

-- orderNumber: backfill deterministically, then make it unique + NOT NULL.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
UPDATE "orders" SET "orderNumber" = 'IPL-' || UPPER(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 8))
  WHERE "orderNumber" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "orderNumber" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_orderNumber_key" ON "orders"("orderNumber");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "dhabaId" TEXT NOT NULL DEFAULT 'dhaba_singarayakonda';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending';

-- New orders start unpaid; the payment gate promotes them to `placed`.
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'awaiting_payment';

-- paymentMethod was free-text; convert to the enum, mapping legacy values.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'paymentMethod' AND data_type = 'text'
  ) THEN
    ALTER TABLE "orders" ALTER COLUMN "paymentMethod" DROP DEFAULT;
    ALTER TABLE "orders" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
      USING (CASE
        WHEN "paymentMethod" IN ('cod', 'cash') THEN 'cod'
        WHEN "paymentMethod" = 'wallet'         THEN 'wallet'
        ELSE 'razorpay'
      END)::"PaymentMethod";
    ALTER TABLE "orders" ALTER COLUMN "paymentMethod" SET DEFAULT 'razorpay';
  END IF;
END $$;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryAddress"     TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "driverId"            TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryOtpHash"     TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryOtpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "acceptedAt"          TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "readyAt"             TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assignedAt"          TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pickedUpAt"          TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveredAt"         TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelledAt"         TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancellationReason"  TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyKey"      TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "promoCode"           TEXT;

-- Legacy denormalised driver fields; DriverProfile replaces them.
ALTER TABLE "orders" DROP COLUMN IF EXISTS "driverName";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "driverPhone";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "paymentId";

CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotencyKey_key" ON "orders"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "orders_userId_idx"          ON "orders"("userId");
CREATE INDEX IF NOT EXISTS "orders_status_idx"          ON "orders"("status");
CREATE INDEX IF NOT EXISTS "orders_createdAt_idx"       ON "orders"("createdAt");
CREATE INDEX IF NOT EXISTS "orders_driverId_idx"        ON "orders"("driverId");
CREATE INDEX IF NOT EXISTS "orders_dhabaId_status_idx"  ON "orders"("dhabaId", "status");
CREATE INDEX IF NOT EXISTS "orders_paymentStatus_idx"   ON "orders"("paymentStatus");

-- Existing orders predate the payment gate; they were already in the kitchen,
-- so mark them settled rather than stranding them in awaiting_payment.
UPDATE "orders" SET "paymentStatus" = 'paid'
  WHERE "status" IN ('delivered', 'out_for_delivery') AND "paymentStatus" = 'pending';

-- ─── 5. New tables ──────────────────────────────────

CREATE TABLE IF NOT EXISTS "staff_credentials" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "employeeId"     TEXT NOT NULL,
  "pinHash"        TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil"    TIMESTAMP(3),
  "lastLoginAt"    TIMESTAMP(3),
  "mustChangePin"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_credentials_userId_key"     ON "staff_credentials"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_credentials_employeeId_key" ON "staff_credentials"("employeeId");
CREATE INDEX        IF NOT EXISTS "staff_credentials_employeeId_idx" ON "staff_credentials"("employeeId");

CREATE TABLE IF NOT EXISTS "payments" (
  "id"                TEXT NOT NULL,
  "orderId"           TEXT NOT NULL,
  "provider"          TEXT NOT NULL DEFAULT 'razorpay',
  "providerOrderId"   TEXT,
  "providerPaymentId" TEXT,
  "providerRefundId"  TEXT,
  "amountPaise"       INTEGER NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'INR',
  "status"            "PaymentStatus" NOT NULL DEFAULT 'pending',
  "method"            "PaymentMethod" NOT NULL DEFAULT 'razorpay',
  "refundedPaise"     INTEGER NOT NULL DEFAULT 0,
  "failureReason"     TEXT,
  "verifiedAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payments_providerPaymentId_key" ON "payments"("providerPaymentId");
CREATE INDEX        IF NOT EXISTS "payments_orderId_idx"           ON "payments"("orderId");
CREATE INDEX        IF NOT EXISTS "payments_providerOrderId_idx"   ON "payments"("providerOrderId");
CREATE INDEX        IF NOT EXISTS "payments_status_idx"            ON "payments"("status");

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id"              TEXT NOT NULL,
  "provider"        TEXT NOT NULL DEFAULT 'razorpay',
  "providerEventId" TEXT NOT NULL,
  "eventType"       TEXT NOT NULL,
  "payload"         JSONB NOT NULL,
  "processedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_providerEventId_key" ON "webhook_events"("providerEventId");
CREATE INDEX        IF NOT EXISTS "webhook_events_eventType_idx"       ON "webhook_events"("eventType");

CREATE TABLE IF NOT EXISTS "wallets" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "balancePaise" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_userId_key" ON "wallets"("userId");

-- The balance floor is enforced by the database, so no interleaving of
-- concurrent debits can drive a wallet negative.
DO $$ BEGIN
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_non_negative"
    CHECK ("balancePaise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "driver_profiles" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "vehicleType"   TEXT NOT NULL DEFAULT 'bike',
  "vehicleNumber" TEXT,
  "isOnline"      BOOLEAN NOT NULL DEFAULT false,
  "lastLat"       DOUBLE PRECISION,
  "lastLng"       DOUBLE PRECISION,
  "lastSeenAt"    TIMESTAMP(3),
  "activeOrderId" TEXT,
  "rating"        DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "dhabaId"       TEXT NOT NULL DEFAULT 'dhaba_singarayakonda',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "driver_profiles_userId_key"        ON "driver_profiles"("userId");
CREATE INDEX        IF NOT EXISTS "driver_profiles_isOnline_dhabaId_idx" ON "driver_profiles"("isOnline", "dhabaId");
CREATE INDEX        IF NOT EXISTS "driver_profiles_dhabaId_idx"       ON "driver_profiles"("dhabaId");

CREATE TABLE IF NOT EXISTS "turfs" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "location"          TEXT NOT NULL,
  "area"              TEXT NOT NULL,
  "address"           TEXT NOT NULL,
  "latitude"          DOUBLE PRECISION,
  "longitude"         DOUBLE PRECISION,
  "pricePerHourPaise" INTEGER NOT NULL,
  "pitchType"         TEXT NOT NULL DEFAULT 'AstroTurf Box',
  "image"             TEXT NOT NULL DEFAULT '',
  "gallery"           TEXT[] DEFAULT ARRAY[]::TEXT[],
  "amenities"         TEXT[] DEFAULT ARRAY[]::TEXT[],
  "description"       TEXT NOT NULL DEFAULT '',
  "rating"            DOUBLE PRECISION NOT NULL DEFAULT 4.5,
  "reviewsCount"      INTEGER NOT NULL DEFAULT 0,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "dhabaId"           TEXT NOT NULL DEFAULT 'dhaba_singarayakonda',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "turfs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "turfs_dhabaId_idx"  ON "turfs"("dhabaId");
CREATE INDEX IF NOT EXISTS "turfs_isActive_idx" ON "turfs"("isActive");

CREATE TABLE IF NOT EXISTS "celebration_packages" (
  "id"             TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "titleHi"        TEXT,
  "subtitle"       TEXT NOT NULL DEFAULT '',
  "subtitleHi"     TEXT,
  "basePricePaise" INTEGER NOT NULL,
  "image"          TEXT NOT NULL DEFAULT '',
  "inclusions"     TEXT[] DEFAULT ARRAY[]::TEXT[],
  "inclusionsHi"   TEXT[] DEFAULT ARRAY[]::TEXT[],
  "recommendedFor" TEXT NOT NULL DEFAULT '',
  "rating"         DOUBLE PRECISION NOT NULL DEFAULT 4.8,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "dhabaId"        TEXT NOT NULL DEFAULT 'dhaba_singarayakonda',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "celebration_packages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "celebration_packages_dhabaId_idx"  ON "celebration_packages"("dhabaId");
CREATE INDEX IF NOT EXISTS "celebration_packages_isActive_idx" ON "celebration_packages"("isActive");

CREATE TABLE IF NOT EXISTS "vouchers" (
  "id"               TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "description"      TEXT NOT NULL DEFAULT '',
  "discountType"     TEXT NOT NULL DEFAULT 'percent',
  "discountValue"    INTEGER NOT NULL,
  "maxDiscountPaise" INTEGER,
  "minSubtotalPaise" INTEGER NOT NULL DEFAULT 0,
  "validFrom"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil"       TIMESTAMP(3),
  "maxRedemptions"   INTEGER,
  "perUserLimit"     INTEGER NOT NULL DEFAULT 1,
  "redemptionCount"  INTEGER NOT NULL DEFAULT 0,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_code_key"     ON "vouchers"("code");
CREATE INDEX        IF NOT EXISTS "vouchers_isActive_idx" ON "vouchers"("isActive");

CREATE TABLE IF NOT EXISTS "voucher_redemptions" (
  "id"            TEXT NOT NULL,
  "voucherId"     TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "orderId"       TEXT,
  "discountPaise" INTEGER NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voucher_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "voucher_redemptions_voucherId_orderId_key" ON "voucher_redemptions"("voucherId", "orderId");
CREATE INDEX        IF NOT EXISTS "voucher_redemptions_voucherId_userId_idx"  ON "voucher_redemptions"("voucherId", "userId");
CREATE INDEX        IF NOT EXISTS "voucher_redemptions_userId_idx"            ON "voucher_redemptions"("userId");

-- ─── 6. Remaining indexes ───────────────────────────

CREATE INDEX IF NOT EXISTS "notifications_userId_read_idx" ON "notifications"("userId", "read");
CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx"   ON "notifications"("createdAt");
CREATE INDEX IF NOT EXISTS "reviews_userId_idx"            ON "reviews"("userId");
CREATE INDEX IF NOT EXISTS "reviews_orderId_idx"           ON "reviews"("orderId");
CREATE INDEX IF NOT EXISTS "reviews_bookingId_idx"         ON "reviews"("bookingId");

-- ─── 7. Foreign keys ────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "turf_slots" ADD CONSTRAINT "turf_slots_turfId_fkey"
    FOREIGN KEY ("turfId") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_voucherId_fkey"
    FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 8. Backfill wallets from the existing ledger ───

INSERT INTO "wallets" ("id", "userId", "balancePaise", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       u."id",
       GREATEST(0, COALESCE((
         SELECT SUM(CASE WHEN wt."type" = 'deduct' THEN -wt."amountPaise" ELSE wt."amountPaise" END)
         FROM "wallet_transactions" wt WHERE wt."userId" = u."id"
       ), 0))::int,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "users" u
ON CONFLICT ("userId") DO NOTHING;

UPDATE "wallet_transactions" wt
SET "walletId" = w."id"
FROM "wallets" w
WHERE w."userId" = wt."userId" AND wt."walletId" IS NULL;
