-- Phase 8 — the address book becomes real.
--
-- `ProfileModal` kept saved addresses in React state seeded with two invented
-- rows. "Add New" appended to that array, showed a success toast, and lost the
-- address on reload — and checkout never saw it, so home delivery meant retyping
-- the full address on every single order.
--
-- Orders keep their own `deliveryAddress` string snapshot. Editing an address
-- here must never rewrite where an already-delivered order was sent.
--
-- IF NOT EXISTS throughout, matching the earlier migrations, so this is safe
-- against a database that already drifted ahead of the migration history.

CREATE TABLE IF NOT EXISTS "addresses" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "detail"    TEXT NOT NULL,
  "landmark"  TEXT,
  "pincode"   TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "addresses_userId_idx" ON "addresses" ("userId");

-- Guarded so a re-run against a drifted database does not error on an
-- already-present constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addresses_userId_fkey'
  ) THEN
    ALTER TABLE "addresses"
      ADD CONSTRAINT "addresses_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
