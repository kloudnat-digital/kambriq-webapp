-- C49: a portion is sold as a free surface; the lot comes afterwards, at
-- bornage. Until then nothing says which part of the ground a portion is, so
-- two may overlap physically while their surfaces fit - a declared limit. This
-- is where a reservation will name its lot once one exists. Nullable, a label,
-- no lot model.
ALTER TABLE "LandReservation" ADD COLUMN "lotRef" TEXT;
