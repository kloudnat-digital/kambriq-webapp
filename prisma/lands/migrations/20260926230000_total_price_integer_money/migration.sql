-- Land.totalPrice becomes integer money (BigInt, whole XAF), the last land price
-- held as a floating-point number. XAF has no minor unit; every stored total is
-- already whole, and ROUND makes that explicit rather than trusted.

-- pricePerM2 is generated from totalPrice, and Postgres does not change the type
-- of a column a generated column reads. It is dropped and re-created from the
-- integer total, with the same expression and the same result.
ALTER TABLE "Land" DROP COLUMN "pricePerM2";
ALTER TABLE "Land" ALTER COLUMN "totalPrice" TYPE BIGINT USING ROUND("totalPrice")::BIGINT;
ALTER TABLE "Land"
  ADD COLUMN "pricePerM2" INTEGER
  GENERATED ALWAYS AS (ROUND(("totalPrice"::numeric / NULLIF("sizeM2", 0)::numeric))::integer) STORED;

-- The price history records totals, and moves with them.
ALTER TABLE "LandPriceHistory"
  ALTER COLUMN "previousTotalPrice" TYPE BIGINT USING ROUND("previousTotalPrice")::BIGINT,
  ALTER COLUMN "newTotalPrice" TYPE BIGINT USING ROUND("newTotalPrice")::BIGINT;
