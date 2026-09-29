-- A73 - an append-only table refuses TRUNCATE.
--
-- The row-level triggers refuse UPDATE and DELETE; TRUNCATE fires no row
-- trigger, so the ledger, its audit trail and the reminders could be emptied in
-- one statement. A statement-level BEFORE TRUNCATE trigger on
-- kambriq_append_only() closes it, and fires too when a TRUNCATE ... CASCADE
-- reaches the table from "Payment". PaymentReminder keeps its own row function
-- for UPDATE and DELETE; its TRUNCATE is refused by the shared one.

CREATE TRIGGER "PaymentReceipt_no_truncate"
  BEFORE TRUNCATE ON "PaymentReceipt"
  FOR EACH STATEMENT EXECUTE FUNCTION kambriq_append_only();

CREATE TRIGGER "PaymentTransition_no_truncate"
  BEFORE TRUNCATE ON "PaymentTransition"
  FOR EACH STATEMENT EXECUTE FUNCTION kambriq_append_only();

CREATE TRIGGER "PaymentReminder_no_truncate"
  BEFORE TRUNCATE ON "PaymentReminder"
  FOR EACH STATEMENT EXECUTE FUNCTION kambriq_append_only();
