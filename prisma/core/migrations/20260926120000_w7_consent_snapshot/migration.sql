-- Wave 7, step 3 - a consent record points at the version it was given to.
--
-- Step 0 created the archive and said, in as many words, that nothing read it
-- yet and that its reader would be the contact form. This is that reader.
--
-- `consentPolicyPath` stays. It is what every existing row carries, and it is
-- still true: the document somebody agreed to. The new column adds the part it
-- could never answer - WHICH WORDING - and it does so by foreign key, so a
-- consent cannot point at a version the archive does not hold.
--
-- Nullable, and the null is not a silence. Nothing archived means nobody has
-- published a policy yet, and a contact request is stored regardless: the lead
-- is the success criterion (L1), and refusing somebody's message because the CMS
-- is empty would be a worse answer than recording that the version is unknown.
-- The count of such rows goes out in the daily digest, so it is a number
-- somebody reads rather than a field nobody looks at.
--
-- ON DELETE RESTRICT matches what the table already is: PolicySnapshot carries a
-- BEFORE DELETE trigger, so no row can be removed by anybody. The constraint
-- says the same thing one layer up, where a reader of the schema can see it.

ALTER TABLE "ContactRequest" ADD COLUMN "consentPolicySnapshotId" TEXT;

CREATE INDEX "ContactRequest_consentPolicySnapshotId_idx"
  ON "ContactRequest"("consentPolicySnapshotId");

ALTER TABLE "ContactRequest"
  ADD CONSTRAINT "ContactRequest_consentPolicySnapshotId_fkey"
  FOREIGN KEY ("consentPolicySnapshotId") REFERENCES "PolicySnapshot"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
