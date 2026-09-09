-- G6: the record that a reminder was sent.
--
-- A reminder changes no state - G3's decision, and the right one: moving the
-- payment would make "we reminded them" indistinguishable from "they did
-- something". But a reminder that leaves no trace cannot be made idempotent,
-- and a daily sweep with no memory sends the same reminder every day until the
-- payment expires. So the fact is recorded here rather than on the payment.
--
-- Append-only, like every other evidential table in this schema. The UNIQUE on
-- (paymentId, offsetDays) is what makes the sweep idempotent: the same reminder
-- cannot be sent twice however many times the job runs.
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,

    -- Which scheduled reminder this was, as days before the deadline.
    -- Stored rather than derived: the schedule is configuration and may change,
    -- and a row that says "the 7-day reminder" must keep meaning that after
    -- somebody edits PAYMENT_REMINDER_OFFSETS_DAYS.
    "offsetDays" INTEGER NOT NULL,

    -- The deadline this reminder was computed against, as it stood at the time.
    "deadlineAt" TIMESTAMP(3) NOT NULL,

    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentReminder_paymentId_offsetDays_key"
    ON "PaymentReminder"("paymentId", "offsetDays");
CREATE INDEX "PaymentReminder_paymentId_idx" ON "PaymentReminder"("paymentId");
CREATE INDEX "PaymentReminder_sentAt_idx" ON "PaymentReminder"("sentAt");

ALTER TABLE "PaymentReminder"
    ADD CONSTRAINT "PaymentReminder_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only, enforced by the database rather than by discipline - the same
-- guarantee PaymentReceipt and PaymentTransition carry. A record of what was
-- communicated is evidence, and evidence that can be edited is not.
CREATE OR REPLACE FUNCTION "payment_reminder_append_only"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'PaymentReminder is append-only: % is refused on %',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_reminder_no_update"
    BEFORE UPDATE ON "PaymentReminder"
    FOR EACH ROW EXECUTE FUNCTION "payment_reminder_append_only"();

CREATE TRIGGER "payment_reminder_no_delete"
    BEFORE DELETE ON "PaymentReminder"
    FOR EACH ROW EXECUTE FUNCTION "payment_reminder_append_only"();
