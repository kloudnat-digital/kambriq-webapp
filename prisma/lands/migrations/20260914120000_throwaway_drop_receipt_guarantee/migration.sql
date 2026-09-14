-- THROWAWAY (A17 red proof): drop one database guarantee so the suite fails.
-- PaymentReceipt_append_only is the trigger that refuses UPDATE/DELETE on the
-- receipt ledger. append-only.dbspec.ts asserts that refusal; with the trigger
-- gone the UPDATE goes through and the assertion fails - which is the point:
-- a suite that only runs green has not been shown to run at all. Reverted before
-- merge; this migration never lands on develop.
DROP TRIGGER IF EXISTS "PaymentReceipt_append_only" ON "PaymentReceipt";
