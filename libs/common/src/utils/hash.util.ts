import * as bcryptjs from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcryptjs.hash(password, SALT_ROUNDS);
};

/**
 * Securely compares a plaintext password against a bcrypt hash.
 * Safely rejects empty hashes (e.g., pending accounts).
 */
export const comparePassword = async (
  password: string,
  hash: string | null | undefined,
): Promise<boolean> => {
  if (!hash) return false;
  return bcryptjs.compare(password, hash);
};
