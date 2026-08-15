-- New OrderStatus value for post-pickup delivery problems.
--
-- Postgres forbids using an enum value in the same transaction that adds it,
-- and Prisma wraps each migration in a transaction — so this ADD VALUE must
-- commit before anything in a later migration can reference 'delivery_failed'.
-- The column additions below use IF NOT EXISTS guards and do not reference the
-- new value, so they are safe alongside it.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'delivery_failed';

-- Where an order's delivery failed, and the rider/flag details surfaced in the
-- admin "Needs Review" queue. `isFlagged`/`flaggedReason`/`flaggedAt` were in
-- schema.prisma but never migrated; this brings the database up to date.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "flaggedReason" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "flaggedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryFailureReason" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryFailedAt" TIMESTAMP(3);