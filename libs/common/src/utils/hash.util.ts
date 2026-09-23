import * as bcryptjs from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcryptjs.hash(password, SALT_ROUNDS);
};

/**
 * Securely compares a plaintext password against a hash.
 *
 * Safely handles null, undefined, or empty hashes that may occur
 * on uninitialized or pending accounts, explicitly returning false.
 *
 * @param password - The plaintext password to evaluate.
 * @param hash - The bcrypt hash to verify against.
 * @returns A boolean indicating whether the password matches the hash.
 */
export const comparePassword = async (
  password: string,
  hash: string | null | undefined,
): Promise<boolean> => {
  if (!hash) return false;
  return bcryptjs.compare(password, hash);
};
