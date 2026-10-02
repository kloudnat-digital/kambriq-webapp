-- C49: a parcel can be sold in portions, so several clients may each hold one.
-- The old index allowed one reservation per parcel unless CANCELLED - COMPLETED
-- included - and would refuse the second buyer of a parcel already partly sold.
--
-- That the portions fit in the parcel is a sum across rows, which no index can
-- hold; the service holds it under a row lock on the parcel. What an index can
-- still hold: one live sale (PENDING or CONFIRMED) per client per parcel.
DROP INDEX "LandReservation_landId_key";

CREATE UNIQUE INDEX "LandReservation_landId_clientEmail_live_key"
  ON "LandReservation" ("landId", "clientEmail")
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));
