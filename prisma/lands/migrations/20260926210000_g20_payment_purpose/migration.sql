-- G20: every payment says what it pays for. The deposit gate asks for a
-- validated ACOMPTE and the balance gate for a validated SOLDE, so one can never
-- stand in for the other.

CREATE TYPE "PaymentPurpose" AS ENUM ('ACOMPTE', 'SOLDE');

-- The default backfills the existing rows, and truthfully: every payment before
-- this migration is a deposit (on dev on 26 September, all 38, each with
-- amountDue equal to its reservation's downPaymentAmount). It is then dropped,
-- so no payment can be created without stating its purpose.
ALTER TABLE "Payment" ADD COLUMN "purpose" "PaymentPurpose" NOT NULL DEFAULT 'ACOMPTE';
ALTER TABLE "Payment" ALTER COLUMN "purpose" DROP DEFAULT;

-- One live payment per reservation and purpose: a second deposit or a second
-- balance cannot open beside a live one. The exits where the money never
-- arrived free the slot for a fresh attempt.
CREATE UNIQUE INDEX "Payment_one_live_per_purpose"
  ON "Payment" ("reservationId", "purpose")
  WHERE "state" NOT IN ('REJETE', 'EXPIRE', 'ANNULE');
