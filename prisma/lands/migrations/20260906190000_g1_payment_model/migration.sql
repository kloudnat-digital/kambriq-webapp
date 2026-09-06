-- G1 - payment data model and state machine.
-- Specification: ops_kambriq_paiement-hybride_v01.md. Overview: docs/ops/g1-payment-model.md.
--
-- Additive only. The four columns on "LandReservation" that carry payment state
-- today are NOT dropped: a drop is irreversible and dev holds 33 reservations.
-- They are backfilled below and marked deprecated in the schema; removal is a
-- later PR, once the new path has been exercised.

CREATE TYPE "PaymentState" AS ENUM (
  'INITIE', 'INSTRUCTIONS_ENVOYEES', 'ANNONCE_CLIENT', 'EN_VERIFICATION',
  'PARTIELLEMENT_RECU', 'VALIDE', 'REJETE', 'EXPIRE', 'ANNULE'
);

CREATE TYPE "PaymentChannel" AS ENUM (
  'VIREMENT', 'MOBILE_MONEY', 'ESPECES', 'ACTE_NOTARIE', 'INCONNU_HISTORIQUE'
);

CREATE TABLE "Payment" (
  "id"            TEXT NOT NULL,
  "reference"     TEXT,
  "reservationId" TEXT NOT NULL,
  "currency"      TEXT NOT NULL,
  -- Indivisible units. XAF has no minor unit: one unit is one franc.
  "amountDue"     BIGINT NOT NULL,
  "state"         "PaymentState" NOT NULL DEFAULT 'INITIE',
  "expiresAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentReceipt" (
  "id"          TEXT NOT NULL,
  "paymentId"   TEXT NOT NULL,
  -- Signed: a correction is a negative line, never an edit of an existing one.
  "amount"      BIGINT NOT NULL,
  "currency"    TEXT NOT NULL,
  "channel"     "PaymentChannel" NOT NULL,
  "receivedAt"  TIMESTAMP(3) NOT NULL,
  "recordedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedBy"  TEXT NOT NULL,
  "evidenceUrl" TEXT,
  "correctsId"  TEXT,
  "note"        TEXT,
  CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentTransition" (
  "id"                TEXT NOT NULL,
  "paymentId"         TEXT NOT NULL,
  "fromState"         "PaymentState",
  "toState"           "PaymentState" NOT NULL,
  "actorUserId"       TEXT NOT NULL,
  "reason"            TEXT NOT NULL,
  "evidenceReceiptId" TEXT,
  "occurredAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");
CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");
CREATE INDEX "Payment_state_idx" ON "Payment"("state");
CREATE INDEX "PaymentReceipt_paymentId_idx" ON "PaymentReceipt"("paymentId");
CREATE INDEX "PaymentReceipt_correctsId_idx" ON "PaymentReceipt"("correctsId");
CREATE INDEX "PaymentTransition_paymentId_idx" ON "PaymentTransition"("paymentId");
CREATE INDEX "PaymentTransition_occurredAt_idx" ON "PaymentTransition"("occurredAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "LandReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransition" ADD CONSTRAINT "PaymentTransition_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The reference format, KBQ-YYMM-XXXXX-C. The generator is G2; the shape is G1.
-- The alphabet excludes O/0, I/1/L and S/5 - the characters that are confused
-- when a reference is dictated on the telephone or copied onto a transfer slip.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reference_format"
  CHECK ("reference" IS NULL OR "reference" ~ '^KBQ-[0-9]{4}-[ABCDEFGHJKMNPQRTUVWXYZ2346789]{5}-[ABCDEFGHJKMNPQRTUVWXYZ2346789]$');

-- Evidence is required for every receipt a person records. NULL is permitted
-- only for rows backfilled from the old columns, which genuinely have none -
-- the old model never recorded a justificatif. Structural, not a convention.
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_evidence_required"
  CHECK ("evidenceUrl" IS NOT NULL OR "channel" = 'INCONNU_HISTORIQUE');

-- Currency is a three-letter ISO 4217 code, upper case.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currency_iso4217" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_currency_iso4217" CHECK ("currency" ~ '^[A-Z]{3}$');

-- ---------------------------------------------------------------------------
-- Append-only, enforced by the database.
--
-- "Rien n'est reecrivable apres coup" is a property of these tables, not a
-- promise made by the service layer. A service can be bypassed by a script, a
-- console, or the next developer in a hurry; a trigger cannot.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION kambriq_append_only() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'append-only table %: % is refused. A correction is a new row, never an edit.',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentReceipt_append_only"
  BEFORE UPDATE OR DELETE ON "PaymentReceipt"
  FOR EACH ROW EXECUTE FUNCTION kambriq_append_only();

CREATE TRIGGER "PaymentTransition_append_only"
  BEFORE UPDATE OR DELETE ON "PaymentTransition"
  FOR EACH ROW EXECUTE FUNCTION kambriq_append_only();

-- ---------------------------------------------------------------------------
-- Backfill. No reservation loses its payment history.
-- ---------------------------------------------------------------------------

-- One Payment per reservation that carries any payment state at all. Amount is
-- the recorded down payment where there is one, rounded to whole francs - the
-- old column is a Float, which is the defect G1 exists to end.
INSERT INTO "Payment" ("id", "reference", "reservationId", "currency", "amountDue", "state", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  NULL,
  r."id",
  'XAF',
  COALESCE(ROUND(r."downPaymentAmount")::bigint, 0),
  CASE
    WHEN r."status" = 'CANCELLED'                 THEN 'ANNULE'::"PaymentState"
    WHEN r."completedAt" IS NOT NULL              THEN 'VALIDE'::"PaymentState"
    WHEN r."downPaymentConfirmed" IS TRUE         THEN 'PARTIELLEMENT_RECU'::"PaymentState"
    ELSE 'INITIE'::"PaymentState"
  END,
  r."createdAt",
  r."updatedAt"
FROM "LandReservation" r;

-- A ledger line for every down payment that was actually confirmed. Channel is
-- INCONNU_HISTORIQUE because the old model never recorded one: saying so is
-- honest, inventing VIREMENT would not be.
INSERT INTO "PaymentReceipt" ("id", "paymentId", "amount", "currency", "channel", "receivedAt", "recordedAt", "recordedBy", "evidenceUrl", "note")
SELECT
  gen_random_uuid()::text,
  p."id",
  ROUND(r."downPaymentAmount")::bigint,
  'XAF',
  'INCONNU_HISTORIQUE',
  COALESCE(r."confirmedAt", r."updatedAt"),
  CURRENT_TIMESTAMP,
  COALESCE(r."confirmedBy", 'backfill'),
  NULL,
  'Backfilled by 20260906190000_g1_payment_model from LandReservation.downPaymentConfirmed.'
FROM "LandReservation" r
JOIN "Payment" p ON p."reservationId" = r."id"
WHERE r."downPaymentConfirmed" IS TRUE
  AND r."downPaymentAmount" IS NOT NULL;

-- And the audit row that says where each backfilled payment came from. Written
-- before the triggers could refuse it - they refuse UPDATE and DELETE, not
-- INSERT.
INSERT INTO "PaymentTransition" ("id", "paymentId", "fromState", "toState", "actorUserId", "reason", "occurredAt")
SELECT
  gen_random_uuid()::text,
  p."id",
  NULL,
  p."state",
  'migration:20260906190000_g1_payment_model',
  'Backfilled from LandReservation payment columns. The pre-G1 model recorded no channel and no evidence.',
  p."createdAt"
FROM "Payment" p;
