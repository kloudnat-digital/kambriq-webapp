-- C49: the reservation carries the surface it buys and its own amount, so the
-- money chain reads the sale and not the parcel. Both required: a null meaning
-- "the whole parcel" would be the two-readings ambiguity G19 removed.
--
-- Every existing reservation is a whole-parcel sale, so its surface is the
-- parcel's and its amount the parcel's total - but only if that total has not
-- moved since the reservation was made. That is checked here, immediately
-- before the write, rather than trusted from a reading taken earlier: if any
-- deposit is not 5 % of the parcel's current total, or any price changed after
-- a reservation was created, the migration refuses and writes nothing.

DO $$
DECLARE
  moved_deposits integer;
  moved_prices integer;
BEGIN
  SELECT count(*) INTO moved_deposits
  FROM "LandReservation" r JOIN "Land" l ON l.id = r."landId"
  WHERE r."downPaymentAmount" IS NOT NULL
    AND r."downPaymentAmount" <> ROUND(l."totalPrice"::numeric * 5 / 100);

  SELECT count(*) INTO moved_prices
  FROM "LandReservation" r
  WHERE EXISTS (
    SELECT 1 FROM "LandPriceHistory" h
    WHERE h."landId" = r."landId" AND h."changedAt" > r."createdAt"
  );

  IF moved_deposits > 0 OR moved_prices > 0 THEN
    RAISE EXCEPTION 'C49 backfill refused: % reservation(s) whose deposit is not 5%% of the current total, % whose parcel was repriced after they were made. The parcel total is not their sale amount; backfill them by hand.', moved_deposits, moved_prices;
  END IF;
END $$;

ALTER TABLE "LandReservation" ADD COLUMN "purchasedM2" DOUBLE PRECISION;
ALTER TABLE "LandReservation" ADD COLUMN "saleAmount" BIGINT;

UPDATE "LandReservation" r
SET "purchasedM2" = l."sizeM2", "saleAmount" = l."totalPrice"
FROM "Land" l
WHERE l.id = r."landId";

ALTER TABLE "LandReservation" ALTER COLUMN "purchasedM2" SET NOT NULL;
ALTER TABLE "LandReservation" ALTER COLUMN "saleAmount" SET NOT NULL;

-- A sale buys some ground and costs something; neither can be zero or less.
ALTER TABLE "LandReservation"
  ADD CONSTRAINT "LandReservation_purchasedM2_positive" CHECK ("purchasedM2" > 0),
  ADD CONSTRAINT "LandReservation_saleAmount_not_negative" CHECK ("saleAmount" >= 0);
