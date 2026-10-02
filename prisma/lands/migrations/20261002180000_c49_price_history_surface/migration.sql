-- C49: the price history records the surface beside the total, so the rate per
-- m2 of a past period stays computable when the surface changes. Required: only
-- possible while the table is empty, because the surface at the moment of an
-- old change was never recorded and cannot be guessed. Checked here, immediately
-- before the column is added: one row and the migration refuses.
DO $$
DECLARE
  existing integer;
BEGIN
  SELECT count(*) INTO existing FROM "LandPriceHistory";
  IF existing > 0 THEN
    RAISE EXCEPTION 'C49 refused: LandPriceHistory holds % row(s) whose surface at the time is unknown. A required surface cannot be added without guessing it.', existing;
  END IF;
END $$;

ALTER TABLE "LandPriceHistory" ADD COLUMN "sizeM2" DOUBLE PRECISION NOT NULL;
ALTER TABLE "LandPriceHistory"
  ADD CONSTRAINT "LandPriceHistory_sizeM2_positive" CHECK ("sizeM2" > 0);
