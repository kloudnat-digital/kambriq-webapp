-- Reverse of 20260906190000_g1_payment_model.
--
-- Prisma does not run down migrations; this exists so the reversal is written,
-- reviewed and tested rather than improvised during an incident. It was run on
-- a scratch database loaded with a copy of dev's 33 reservations, and
-- `LandReservation` came back byte-identical.
--
-- Safe only while the new tables are still shadow data. Once payments are
-- recorded through the new path and not into the deprecated columns, this
-- destroys history: the whole point of G1 is that the ledger is the record.

DROP TRIGGER IF EXISTS "PaymentTransition_append_only" ON "PaymentTransition";
DROP TRIGGER IF EXISTS "PaymentReceipt_append_only" ON "PaymentReceipt";
DROP FUNCTION IF EXISTS kambriq_append_only();

DROP TABLE IF EXISTS "PaymentTransition";
DROP TABLE IF EXISTS "PaymentReceipt";
DROP TABLE IF EXISTS "Payment";

DROP TYPE IF EXISTS "PaymentChannel";
DROP TYPE IF EXISTS "PaymentState";
