-- G19: `Land.price` carried two units - a total to the API and the seed, a
-- price per m2 to the web. The total is the source of truth: it is the
-- contractual amount, what the deposit is computed from and what the ledger
-- asks for. The price per m2 is derived by the database and cannot be written,
-- so the two can never disagree.

ALTER TABLE "Land" RENAME COLUMN "price" TO "totalPrice";
ALTER INDEX "Land_price_idx" RENAME TO "Land_totalPrice_idx";

-- Whole francs, as an integer: XAF has no minor unit, and money is never a
-- floating-point type. NULLIF keeps a zero surface from dividing; such a row
-- has no price per m2 rather than a wrong one.
ALTER TABLE "Land"
  ADD COLUMN "pricePerM2" INTEGER
  GENERATED ALWAYS AS (ROUND(("totalPrice" / NULLIF("sizeM2", 0))::numeric)::integer) STORED;

ALTER TABLE "LandPriceHistory" RENAME COLUMN "previousPrice" TO "previousTotalPrice";
ALTER TABLE "LandPriceHistory" RENAME COLUMN "newPrice" TO "newTotalPrice";
