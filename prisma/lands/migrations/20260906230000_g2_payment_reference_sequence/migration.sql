-- G2 - the counter behind the payment reference.
--
-- **Collision-free by construction, not by improbability.** A random body drawn
-- from 29^5 would be "unlikely to collide"; a sequence cannot collide at all,
-- because Postgres serialises `nextval` across concurrent transactions and never
-- returns the same value twice - including to transactions that later roll back,
-- which is why gaps are expected and harmless here.
--
-- G1's unique index on "Payment"."reference" stays, as the backstop it was
-- built to be: it catches the one case the sequence cannot, which is the counter
-- wrapping the 20 511 149-value body space inside a single month.
CREATE SEQUENCE IF NOT EXISTS payment_reference_seq AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Every payment created from here on carries one. The column stays nullable at
-- the database level for the rows G1 backfilled, which predate the generator -
-- dropping their NULLs would mean inventing references for payments that never
-- had one. `PaymentsService.createPayment` is what makes it non-null in practice,
-- and `no-payment-without-reference.spec.ts` is what keeps it that way.
COMMENT ON COLUMN "Payment"."reference" IS
  'KBQ-YYMM-XXXXX-C. Assigned at creation by PaymentsService.createPayment (G2). NULL only on rows backfilled by G1, which predate the generator.';
