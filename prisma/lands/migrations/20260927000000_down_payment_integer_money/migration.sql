-- LandReservation.downPaymentAmount becomes integer money (BigInt, whole XAF).
-- It is written from depositFor(totalPrice), already a whole number, and the G1
-- backfill read it with the same ROUND; making it explicit keeps the two equal.
-- The column stays nullable and deprecated (G1): only its type changes.
ALTER TABLE "LandReservation"
  ALTER COLUMN "downPaymentAmount" TYPE BIGINT USING ROUND("downPaymentAmount")::BIGINT;
