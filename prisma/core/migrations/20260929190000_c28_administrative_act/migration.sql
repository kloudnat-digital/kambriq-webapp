-- C28 step 1 - the record of administrative acts on an account.
--
-- Actor, time, reason, the attribute, its old and new value. Nothing writes to
-- it yet: the dedicated role and the address correction are later steps, and
-- they read and write through this table.
--
-- No foreign key to "User": the record of an account must outlive the account,
-- and ON DELETE SET NULL would be an UPDATE the trigger below refuses.

CREATE TABLE "AdministrativeAct" (
    "id" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdministrativeAct_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdministrativeAct_reason_not_blank" CHECK (length(btrim("reason")) > 0)
);

CREATE INDEX "AdministrativeAct_subjectUserId_occurredAt_idx"
  ON "AdministrativeAct" ("subjectUserId", "occurredAt");

-- Append-only, by the function the policy snapshot archive already uses in
-- this database (20260925120000). A correction is a new row, never an edit.
CREATE TRIGGER "AdministrativeAct_append_only"
  BEFORE UPDATE OR DELETE ON "AdministrativeAct"
  FOR EACH ROW EXECUTE FUNCTION kambriq_append_only();
