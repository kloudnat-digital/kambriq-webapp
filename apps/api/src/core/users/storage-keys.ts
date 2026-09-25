/**
 * A44, A49 - where a person's files live in storage, defined once.
 *
 * The upload routes issue these keys, and the write paths accept only these
 * keys, so the two cannot drift. A person's avatar or identity document is a
 * key in THEIR folder - never a URL, not even one on our bucket: storage
 * resolves keys, and a second accepted form is a second way to store an address
 * somebody else chose. `StorageService.getDownloadUrl` returns an `http(s)`
 * value unchanged, so an accepted address would travel as it stands.
 */
export type UserFolder = 'avatar' | 'id-documents';

/** The characters an uploaded file name keeps; anything else becomes `_`. No `/`. */
export const safeFileName = (name: string): string => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export const userFileKey = (
  userId: string,
  folder: UserFolder,
  timestamp: number,
  safeName: string,
): string => `users/${userId}/${folder}/${timestamp}-${safeName}`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `value` is a key the upload route could have issued to `userId` in `folder`. */
export const isOwnUserFileKey = (userId: string, folder: UserFolder, value: string): boolean =>
  new RegExp(`^users/${escape(userId)}/${folder}/\\d+-[a-zA-Z0-9._-]+$`).test(value);
