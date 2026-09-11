-- L1 - the inbound contact request.
--
-- The public contact form displayed a success toast and sent nothing: its
-- submit handler awaited a 800 ms timeout, showed the toast and reset the
-- fields. Every commercial CTA on the site leads to that form, so every
-- prospect who used it since it shipped is unrecoverable. This table is where
-- the next one lands.

CREATE TYPE "ContactSubject" AS ENUM ('LANDS', 'VERIFY', 'KAMNET', 'KBS', 'PARTNERSHIP', 'OTHER');

CREATE TYPE "ContactRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED');

CREATE TABLE "ContactRequest" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "email"             TEXT NOT NULL,
  "phone"             TEXT,
  "subject"           "ContactSubject" NOT NULL,
  "message"           TEXT NOT NULL,
  "locale"            TEXT NOT NULL DEFAULT 'fr',
  -- Consent is a fact about a moment, so the moment is the record of the fact.
  -- NOT NULL is the guarantee: the checkbox can be bypassed, the DTO can be
  -- called round, and a row still cannot exist without a consent timestamp.
  "consentGivenAt"    TIMESTAMP(3) NOT NULL,
  -- What was consented TO. Consent is to a document and documents change; a row
  -- that records agreement without naming what was agreed to says nothing.
  "consentPolicyPath" TEXT NOT NULL,
  "status"            "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- The digest counts a 48-hour window on every run.
CREATE INDEX "ContactRequest_createdAt_idx" ON "ContactRequest"("createdAt");
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- A request must carry something a person can answer. Empty strings pass a
-- NOT NULL and are the shape a bad client sends; the DTO refuses them and this
-- refuses them again for anything that does not go through the DTO.
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_has_content"
  CHECK (btrim("name") <> '' AND btrim("email") <> '' AND btrim("message") <> '');

-- The locale is one of the two the site is published in. A row carrying 'de'
-- would be acknowledged in the fallback language with nothing saying why.
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_locale_supported"
  CHECK ("locale" IN ('fr', 'en'));
