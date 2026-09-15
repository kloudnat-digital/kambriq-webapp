-- I15 renewal: a renewal issues a NEW certificate, with its own number and its
-- own dates, and the old one stays in the register, verifiable as expired or
-- revoked. A candidate therefore holds several certificates over time; the
-- current one is the newest. No row is touched.

-- DropIndex
DROP INDEX "KbsCertificate_candidateId_key";

-- CreateIndex
CREATE INDEX "KbsCertificate_candidateId_idx" ON "KbsCertificate"("candidateId");
