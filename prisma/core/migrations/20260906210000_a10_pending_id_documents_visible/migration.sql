-- A10 - make a pending identity document visible and ageable.
--
-- 59 documents sat at `pending`, `verified: 0`, `rejected: 0`, and nothing in
-- the data said how long any of them had waited: the profile recorded when a
-- document was VERIFIED but never when it was SUBMITTED.
--
-- Additive and nullable. Existing pending rows are backfilled from `updatedAt`,
-- which is the closest honest approximation - the row was last touched when the
-- document was submitted, because nothing has touched it since.
ALTER TABLE "UserProfile" ADD COLUMN "idSubmittedAt" TIMESTAMP(3);

UPDATE "UserProfile"
SET "idSubmittedAt" = "updatedAt"
WHERE "idVerificationStatus" = 'pending' AND "idSubmittedAt" IS NULL;
