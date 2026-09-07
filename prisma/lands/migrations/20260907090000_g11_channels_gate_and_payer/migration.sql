-- ---------------------------------------------------------------------------
-- G11-G14 - six channels, the declared preference, and who actually paid
--
-- Specification: ops_kambriq_paiement-hybride_v03, sections 4b, 4c and 6.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The channel enum is rebuilt, not extended.
--
-- Four of the five old values map one-to-one onto a new code. The fifth,
-- MOBILE_MONEY, does not: v03 splits mobile money into OMO (Orange) and MOMO
-- (MTN) because they differ in number, in confirmation format and in dispute
-- procedure, and **the old model never recorded which one it was**.
--
-- Guessing would put a name on a row nobody can stand behind. So those rows go
-- to HIST, which means exactly "a row taken over whose channel was not
-- recorded" - and that is a true statement about them.
--
-- **The first draft also wrote the old value into the row's note, and the
-- append-only trigger refused it**: "append-only table PaymentReceipt: UPDATE
-- is refused. A correction is a new row, never an edit." The trigger was right
-- and the migration was wrong. A schema migration is not an exemption from
-- immutability, and disabling the trigger to annotate a row would have replaced
-- a guarantee held by the database with one held by whoever remembers to turn
-- it back on. The loss of nuance - "it was some mobile money" - is recorded
-- here and in the register instead, where rewriting nothing costs nothing.
--
-- `ALTER COLUMN ... USING` is DDL and does not fire row triggers, so the
-- mapping below is allowed where the UPDATE was not.
--
-- Postgres cannot drop a value from an enum in place, so the type is recreated.
-- ---------------------------------------------------------------------------

ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_evidence_required";

CREATE TYPE "PaymentChannel_new" AS ENUM ('VIR', 'DEPO', 'OMO', 'MOMO', 'ESP', 'NOTA', 'HIST');

ALTER TABLE "PaymentReceipt"
  ALTER COLUMN "channel" TYPE "PaymentChannel_new"
  USING (
    CASE "channel"::text
      WHEN 'VIREMENT'           THEN 'VIR'
      WHEN 'ESPECES'            THEN 'ESP'
      WHEN 'ACTE_NOTARIE'       THEN 'NOTA'
      WHEN 'INCONNU_HISTORIQUE' THEN 'HIST'
      WHEN 'MOBILE_MONEY'       THEN 'HIST'
    END
  )::"PaymentChannel_new";

DROP TYPE "PaymentChannel";
ALTER TYPE "PaymentChannel_new" RENAME TO "PaymentChannel";

-- Re-created against the new code. Unchanged in meaning: a receipt without its
-- proof is refused, and the only exception stays confined to rows taken over.
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_evidence_required"
  CHECK ("evidenceUrl" IS NOT NULL OR "channel" = 'HIST');

-- ---------------------------------------------------------------------------
-- 2. Who actually paid.
--
-- A deposit is made at a counter, in cash, often by somebody who is not the
-- client. Without this the back office holds a slip bearing an unrecognised
-- name and cannot match it. Required for DEPO, and for DEPO only - demanding it
-- everywhere would make people type the client's own name over and over until
-- they stopped reading the field.
-- ---------------------------------------------------------------------------

ALTER TABLE "PaymentReceipt" ADD COLUMN "paidBy" TEXT;

ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_depo_requires_payer"
  CHECK ("channel" <> 'DEPO' OR ("paidBy" IS NOT NULL AND btrim("paidBy") <> ''));

-- ---------------------------------------------------------------------------
-- 3. Two channel columns on the payment, never one.
--
-- `preferredChannel` is what the client said would suit them and binds nothing.
-- `channel` is what the back office chose and communicated, and is the record.
-- Merging them would let a wish become the record of what was used, and on the
-- day the two differ nothing would say which one is being read.
-- ---------------------------------------------------------------------------

ALTER TABLE "Payment" ADD COLUMN "preferredChannel" "PaymentChannel";
ALTER TABLE "Payment" ADD COLUMN "channel" "PaymentChannel";

-- Neither may ever hold the marker for rows taken over: it is a record of the
-- past, not something a client can wish for or an operator can choose.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_channels_are_selectable"
  CHECK (
    ("preferredChannel" IS NULL OR "preferredChannel" <> 'HIST')
    AND ("channel" IS NULL OR "channel" <> 'HIST')
  );

-- ---------------------------------------------------------------------------
-- 4. What the transition recorded, beyond who and why.
--
-- v03 section 4d: the transition records "qui, quand, quel canal, et pourquoi".
-- `communicatedDetails` holds the coordinates as they were actually sent, so a
-- dispute is settled by the system rather than by somebody's screenshot. Both
-- are append-only like the rest of the table, which is what makes them evidence.
-- ---------------------------------------------------------------------------

ALTER TABLE "PaymentTransition" ADD COLUMN "channel" "PaymentChannel";
ALTER TABLE "PaymentTransition" ADD COLUMN "communicatedDetails" JSONB;
