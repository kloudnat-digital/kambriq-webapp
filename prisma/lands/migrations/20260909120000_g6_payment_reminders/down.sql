DROP TRIGGER IF EXISTS "payment_reminder_no_delete" ON "PaymentReminder";
DROP TRIGGER IF EXISTS "payment_reminder_no_update" ON "PaymentReminder";
DROP FUNCTION IF EXISTS "payment_reminder_append_only"();
DROP TABLE IF EXISTS "PaymentReminder";
