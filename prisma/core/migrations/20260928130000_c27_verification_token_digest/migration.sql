-- C27 - verification, reset and email-change tokens are stored as their SHA-256
-- digest, never as the value the link carries.
--
-- Rows written before this held the value in clear. They are hashed in place, so
-- every link already sent keeps working: the API hashes the value it receives
-- and looks the digest up. The expression is byte for byte Node's
-- createHash('sha256').update(token).digest('hex')
-- (verification-token-digest.dbspec.ts).
UPDATE "VerificationToken" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
