/**
 * A44 - where a person's avatar lives in storage, defined once.
 *
 * The upload route issues this key and `updateMe` accepts only this key, so the
 * two cannot drift. An avatar is a key in the caller's own folder - never a URL,
 * not even one on our bucket: storage resolves keys, and a second accepted form
 * is a second way to store an address somebody else chose.
 */
export const avatarKey = (userId: string, timestamp: number, safeName: string): string =>
  `users/${userId}/avatar/${timestamp}-${safeName}`;

/** The characters an uploaded file name keeps; anything else becomes `_`. No `/`. */
export const safeFileName = (name: string): string => name.replace(/[^a-zA-Z0-9._-]/g, '_');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `value` is an avatar key the upload route could have issued to `userId`. */
export const isOwnAvatarKey = (userId: string, value: string): boolean =>
  new RegExp(`^users/${escape(userId)}/avatar/\\d+-[a-zA-Z0-9._-]+$`).test(value);
