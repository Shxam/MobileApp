ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'kitchen_staff';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'delivery_partner';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "favoriteTeam" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryTarget" TEXT NOT NULL DEFAULT 'Pickup counter';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cookingInstructions" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "estimatedDeliveryMinutes" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "driverName" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "driverPhone" TEXT;

CREATE TABLE IF NOT EXISTS "driver_locations" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "heading" DOUBLE PRECISION,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "driver_locations_orderId_key" ON "driver_locations"("orderId");
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
