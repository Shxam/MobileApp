-- Google OAuth Onboarding — migrate customer auth from Firebase SMS OTP to
-- 1-Click Google OAuth.
--
-- 1. `email` — unique for customers, nullable for staff accounts.
-- 2. `avatar` — Google profile picture URL.
-- 3. `phone` — becomes nullable so a fresh Google sign-in can create a user
--    before the customer completes the profile step (phone + favorite team).
--
-- IF NOT EXISTS throughout, matching the earlier migrations, so this is safe
-- against a database that already drifted ahead of the migration history.

-- 1. Add `email` column (unique, nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "email" TEXT;
  END IF;
END $$;

-- Unique index on email (only where non-null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_email_key'
  ) THEN
    CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
  END IF;
END $$;

-- 2. Add `avatar` column (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'avatar'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "avatar" TEXT;
  END IF;
END $$;

-- 3. Make `phone` nullable — a Google sign-in creates the user before the
--    customer supplies their phone number in the onboarding step.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;
  END IF;
END $$;