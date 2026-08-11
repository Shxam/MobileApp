-- New OrderStatus values, isolated in their own migration.
--
-- Postgres forbids using an enum value in the same transaction that adds it,
-- and Prisma wraps each migration in a transaction — so these must commit
-- before the Phase 2 migration can reference them (e.g. as a column default).

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'payment_failed';
