-- G11 - the client's declared channel preference, kept on the profile so the
-- next request proposes it by default (v03 section 4c).
--
-- A plain TEXT column, not an enum: `PaymentChannel` is a type in the lands
-- database and this is core. The two are kept in step by a test rather than by
-- a foreign key, because there is no such thing across databases here.
ALTER TABLE "UserProfile" ADD COLUMN "preferredPaymentChannel" TEXT;
