/**
 * D20 - one place that decides how this application connects to Redis.
 *
 * ElastiCache on dev runs with `AuthTokenEnabled = false` and
 * `TransitEncryptionEnabled = false`: no password, no TLS. Anyone who reaches
 * the VPC reaches the session store and the five queues - and since D1 that is
 * the VPC production will share.
 *
 * AUTH cannot be switched on alone: AWS requires in-transit encryption for it
 * ("AUTH can only be enabled for encryption in-transit enabled clusters"). So
 * the application has to speak TLS **and** send a password, and it has to be
 * able to do that BEFORE the cluster demands it, or dev goes down at the moment
 * the infrastructure changes.
 *
 * Hence this helper, and hence its shape:
 *
 *   - **Both options are independent and both default to off.** With neither
 *     variable set the result is exactly today's `{ host, port }`, so the local
 *     compose Redis (`redis:7-alpine`, no TLS, no password) keeps working and
 *     so does the current dev task.
 *   - **TLS is opt-in by `REDIS_TLS`.** ElastiCache's transit encryption has a
 *     `preferred` mode that accepts encrypted and unencrypted connections at
 *     the same time; that is the window in which this flag flips, with nothing
 *     else changing.
 *   - **`servername` is set explicitly.** ElastiCache presents a certificate
 *     for the cluster endpoint; without SNI the handshake fails on a name
 *     mismatch, which surfaces as a connection error with no mention of TLS.
 *
 * One implementation, three callers: `RedisService`, the BullMQ root connection
 * in `QueueModule`, and `prisma/bootstrap-admins.ts` - the one-off ECS task that
 * enqueues the administrator verification mail on every deploy, and which is
 * the client people forget because it is not the API.
 */

/** Reads one configuration value. `ConfigService.get` and `process.env` both fit. */
export type RedisEnvLookup = (key: string) => string | undefined;

export interface RedisConnectionOptions {
  host: string;
  port: number;
  /** Absent unless REDIS_PASSWORD is set: ioredis sends AUTH only when present. */
  password?: string;
  /** Absent unless REDIS_TLS is on. `{}` would still enable TLS, without SNI. */
  tls?: { servername: string };
}

/** `true` for "true" and "1", in any case. Anything else, including "", is off. */
const isOn = (value: string | undefined): boolean =>
  value !== undefined && ['true', '1'].includes(value.trim().toLowerCase());

export const redisConnectionOptions = (get: RedisEnvLookup): RedisConnectionOptions => {
  const host = get('REDIS_HOST') || 'localhost';
  const port = Number(get('REDIS_PORT') ?? 6379);
  const password = get('REDIS_PASSWORD');
  const options: RedisConnectionOptions = { host, port };

  // An empty string is what an unset ECS secret looks like; it is not a
  // password, and sending AUTH with it fails the handshake.
  if (password) options.password = password;
  if (isOn(get('REDIS_TLS'))) options.tls = { servername: host };

  return options;
};
