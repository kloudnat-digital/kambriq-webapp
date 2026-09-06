import * as bcryptjs from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcryptjs.hash(password, SALT_ROUNDS);
};

/**
 * `hash` is nullable because `User.passwordHash` is.
 *
 * A bootstrapped account, and a client created by a land reservation, both exist
 * before anybody has chosen a password. No password can match "no password", so
 * this answers `false` - explicitly, at the top, rather than by handing `null`
 * to bcrypt and trusting what it does with it. `bcryptjs.compare` is not
 * documented for a null hash, and "it returned false when I tried it" is a
 * statement about one version of one library.
 *
 * The empty string is folded in for the same reason: `passwordHash: ''` was the
 * old sentinel for "must reset", and any row written before the column became
 * nullable still carries it.
 */
export const comparePassword = async (
  password: string,
  hash: string | null | undefined,
): Promise<boolean> => {
  if (!hash) return false;
  return bcryptjs.compare(password, hash);
};
