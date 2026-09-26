-- KamnetCommission.amount becomes integer money (BigInt, whole XAF), the last
-- monetary Float in the four schemas. The create DTO already accepts only whole
-- amounts; ROUND makes the stored ones explicit rather than trusted.
-- `pv` and `tpc` stay Float: they are a coefficient and a rate, not money.
ALTER TABLE "KamnetCommission"
  ALTER COLUMN "amount" TYPE BIGINT USING ROUND("amount")::BIGINT;
