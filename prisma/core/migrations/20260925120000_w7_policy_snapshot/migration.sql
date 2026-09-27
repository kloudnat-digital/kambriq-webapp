-- Wave 7, step 0 - the policy snapshot archive.
--
-- `ContactRequest.consentPolicyPath` records what was consented to as
-- `/legal/privacy`: the document, never the version. Its own migration says
-- "consent is to a document and documents change; a row that records agreement
-- without naming what was agreed to says nothing" - and then stores a path, so
-- the guarantee the comment describes is one step stronger than the value
-- delivers.
--
-- Sanity keeps 3 days of revision history on the plan this project uses. A
-- stored `_rev` is therefore a reference that expires long before anybody asks
-- what a policy said. The rendered bytes are kept here instead.
--
-- Nothing writes to this table yet. Its writer is the publish webhook and its
-- reader is the contact form; both are later steps of this wave, and that is
-- recorded in the register rather than left to be discovered.

CREATE TABLE "PolicySnapshot" (
  "id"          TEXT NOT NULL,
  -- The Sanity document and revision this copy was taken from. Provenance:
  -- enough to say where it came from, never enough to fetch it again.
  "documentId"  TEXT NOT NULL,
  "revision"    TEXT NOT NULL,
  -- Under document-level internationalisation each language is its own
  -- document, so the locale belongs to the document rather than to a field.
  "locale"      TEXT NOT NULL,
  -- The policy this is, independent of Sanity. What a caller looks up.
  "slug"        TEXT NOT NULL,
  -- The document as it was served. The archive is self-contained on purpose:
  -- it must resolve without Sanity, without our renderer, and without the
  -- component tree that happened to exist on the day it was written.
  "rendered"    TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PolicySnapshot_pkey" PRIMARY KEY ("id")
);

-- A webhook can be delivered more than once. One row per revision.
CREATE UNIQUE INDEX "PolicySnapshot_documentId_revision_key"
  ON "PolicySnapshot" ("documentId", "revision");

-- "Which version of this policy was current at that moment" - the question
-- consent depends on being able to answer.
CREATE INDEX "PolicySnapshot_slug_locale_publishedAt_idx"
  ON "PolicySnapshot" ("slug", "locale", "publishedAt");

-- ---------------------------------------------------------------------------
-- Append-only, held by the database rather than promised by a service.
--
-- A service can be bypassed by a script, a console, or the next person in a
-- hurry; a trigger cannot. The function is `kambriq_append_only()` as G1 wrote
-- it for the payment ledger - core and lands are separate databases, so each
-- carries its own copy of the definition.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION kambriq_append_only() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'append-only table %: % is refused. A correction is a new row, never an edit.',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PolicySnapshot_append_only"
  BEFORE UPDATE OR DELETE ON "PolicySnapshot"
  FOR EACH ROW EXECUTE FUNCTION kambriq_append_only();
