-- Migration: split fullName → firstName + lastName
-- Existing data is split on the first space:
--   "Asad Manzoor" → firstName="Asad", lastName="Manzoor"
--   "Asad"         → firstName="Asad", lastName=NULL

-- Step 1: Add new columns (nullable so existing rows don't violate constraints)
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName"  TEXT;

-- Step 2: Migrate existing data
UPDATE "User"
SET
  "firstName" = CASE
    WHEN "fullName" IS NULL THEN NULL
    ELSE split_part("fullName", ' ', 1)
  END,
  "lastName" = CASE
    WHEN "fullName" IS NULL            THEN NULL
    WHEN position(' ' IN "fullName") = 0 THEN NULL
    ELSE ltrim(substring("fullName" FROM position(' ' IN "fullName")))
  END;

-- Step 3: Drop old column
ALTER TABLE "User" DROP COLUMN "fullName";
