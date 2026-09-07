-- Reverse of 20260907090000_g11_channels_gate_and_payer.
--
-- Lossy by nature and it says so: OMO and MOMO both collapse back to
-- MOBILE_MONEY, and DEPO has no pre-v03 equivalent at all - it becomes
-- VIREMENT, which is the closest thing the old model could express and is not
-- the same fact. Rolling this back therefore destroys information that the
-- forward migration created. Run it only on a scratch database.

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_channels_are_selectable";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "channel";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "preferredChannel";

ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_depo_requires_payer";
ALTER TABLE "PaymentReceipt" DROP COLUMN IF EXISTS "paidBy";
ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_evidence_required";

CREATE TYPE "PaymentChannel_old" AS ENUM ('VIREMENT', 'MOBILE_MONEY', 'ESPECES', 'ACTE_NOTARIE', 'INCONNU_HISTORIQUE');

ALTER TABLE "PaymentReceipt"
  ALTER COLUMN "channel" TYPE "PaymentChannel_old"
  USING (
    CASE "channel"::text
      WHEN 'VIR'  THEN 'VIREMENT'
      WHEN 'DEPO' THEN 'VIREMENT'
      WHEN 'OMO'  THEN 'MOBILE_MONEY'
      WHEN 'MOMO' THEN 'MOBILE_MONEY'
      WHEN 'ESP'  THEN 'ESPECES'
      WHEN 'NOTA' THEN 'ACTE_NOTARIE'
      WHEN 'HIST' THEN 'INCONNU_HISTORIQUE'
    END
  )::"PaymentChannel_old";

DROP TYPE "PaymentChannel";
ALTER TYPE "PaymentChannel_old" RENAME TO "PaymentChannel";

ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_evidence_required"
  CHECK ("evidenceUrl" IS NOT NULL OR "channel" = 'INCONNU_HISTORIQUE');

ALTER TABLE "PaymentTransition" DROP COLUMN IF EXISTS "communicatedDetails";
ALTER TABLE "PaymentTransition" DROP COLUMN IF EXISTS "channel";
