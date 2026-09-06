-- A bootstrapped administrator exists before anybody has chosen a password.
--
-- The alternative was an unusable sentinel hash, which is a value that lies
-- about what it is: every read of the column would have to know the sentinel to
-- tell "no password" from "a password nobody can guess". A NULL says it once, in
-- the schema, and `tsc` then makes every reader handle it.
--
-- Widening NOT NULL to NULL rewrites no rows and takes no exclusive lock beyond
-- the catalogue update. It is reversible only while no row holds NULL.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
