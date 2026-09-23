/**
 * Redis Connection Configuration
 *
 * Provides a unified mechanism to generate connection options for Redis clients across the application.
 * Manages conditional configuration of TLS and authentication to ensure compatibility
 * across different environments (e.g., local development, AWS ElastiCache).
 */

/** Callback function for retrieving environment configuration values. */
export type RedisEnvLookup = (key: string) => string | undefined;

export interface RedisConnectionOptions {
  host: string;
  port: number;
  /** Optional authentication password for the Redis server. */
  password?: string;
  /** TLS configuration for secure connections. Includes SNI support via `servername`. */
  tls?: { servername: string };
}

/** Helper to parse a string value into a boolean. Returns true for "true" or "1". */
const isOn = (value: string | undefined): boolean =>
  value !== undefined && ['true', '1'].includes(value.trim().toLowerCase());

export const redisConnectionOptions = (get: RedisEnvLookup): RedisConnectionOptions => {
  const host = get('REDIS_HOST') || 'localhost';
  const port = Number(get('REDIS_PORT') ?? 6379);
  const password = get('REDIS_PASSWORD');
  const options: RedisConnectionOptions = { host, port };

  // Treat empty strings as no password to prevent handshake failures.
  if (password) options.password = password;
  if (isOn(get('REDIS_TLS'))) options.tls = { servername: host };

  return options;
};
