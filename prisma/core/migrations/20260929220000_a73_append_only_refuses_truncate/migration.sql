-- A73 - an append-only table refuses TRUNCATE.
--
-- The row-level triggers refuse UPDATE and DELETE; TRUNCATE fires no row
-- trigger, so each table could be emptied in one statement. A statement-level
-- BEFORE TRUNCATE trigger on the same function closes it, and fires too when a
-- TRUNCATE ... CASCADE reaches the table from another one.

CREATE TRIGGER "PolicySnapshot_no_truncate"
  BEFORE TRUNCATE ON "PolicySnapshot"
  FOR EACH STATEMENT EXECUTE FUNCTION kambriq_append_only();

CREATE TRIGGER "AdministrativeAct_no_truncate"
  BEFORE TRUNCATE ON "AdministrativeAct"
  FOR EACH STATEMENT EXECUTE FUNCTION kambriq_append_only();
