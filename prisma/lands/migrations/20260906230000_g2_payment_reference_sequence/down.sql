-- Reverse of 20260906230000_g2_payment_reference_sequence.
-- References already issued are left in place: they are printed on transfer
-- slips and read aloud by notaries, and a reference that stops resolving is
-- worse than a sequence that is not there.
DROP SEQUENCE IF EXISTS payment_reference_seq;
