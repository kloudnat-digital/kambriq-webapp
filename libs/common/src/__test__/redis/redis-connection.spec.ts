import { redisConnectionOptions } from '../../redis/redis-connection';

/**
 * D20 - the client must be able to connect BOTH ways.
 *
 * The order that makes the change safe is: application first, cluster second.
 * ElastiCache's `preferred` transit mode accepts encrypted and unencrypted
 * connections at once, so there is a window in which the same build must work
 * against a cluster with no password and against one that requires TLS and a
 * token. That is what this pins - both directions, not just the new one.
 *
 * The three callers (RedisService, the BullMQ root connection, and
 * prisma/bootstrap-admins.ts) all take their options from this function, so a
 * client that forgets TLS is a failure here rather than a connection that hangs
 * on dev.
 */
describe('D20 - redisConnectionOptions', () => {
  const lookup = (env: Record<string, string | undefined>) => (key: string) => env[key];

  it('is exactly today’s behaviour when neither variable is set', () => {
    const options = redisConnectionOptions(
      lookup({ REDIS_HOST: 'kambriq-dev-redis.example.cache.amazonaws.com', REDIS_PORT: '6379' }),
    );

    expect(options).toEqual({
      host: 'kambriq-dev-redis.example.cache.amazonaws.com',
      port: 6379,
    });
    // Not `password: undefined` / `tls: undefined`: ioredis treats a present
    // `tls` key as "use TLS", whatever its value.
    expect('password' in options).toBe(false);
    expect('tls' in options).toBe(false);
  });

  it('falls back to localhost:6379, which is what the compose Redis is', () => {
    expect(redisConnectionOptions(lookup({}))).toEqual({ host: 'localhost', port: 6379 });
  });

  it('sends the token when one is configured', () => {
    const options = redisConnectionOptions(
      lookup({ REDIS_HOST: 'r', REDIS_PORT: '6379', REDIS_PASSWORD: 's3cret-token' }),
    );

    expect(options.password).toBe('s3cret-token');
    expect('tls' in options).toBe(false);
  });

  it('ignores an empty password, because that is what an unset ECS secret looks like', () => {
    const options = redisConnectionOptions(lookup({ REDIS_HOST: 'r', REDIS_PASSWORD: '' }));

    expect('password' in options).toBe(false);
  });

  it('enables TLS with SNI set to the endpoint, or the handshake fails on the name', () => {
    const host = 'kambriq-dev-redis.sbdmsp.ng.0001.euc1.cache.amazonaws.com';
    const options = redisConnectionOptions(lookup({ REDIS_HOST: host, REDIS_TLS: 'true' }));

    expect(options.tls).toEqual({ servername: host });
  });

  it.each(['true', 'TRUE', ' True ', '1'])('treats %p as on', (value) => {
    expect(redisConnectionOptions(lookup({ REDIS_TLS: value })).tls).toBeDefined();
  });

  it.each(['false', 'FALSE', '0', '', 'yes', 'no', undefined])('treats %p as off', (value) => {
    expect('tls' in redisConnectionOptions(lookup({ REDIS_TLS: value }))).toBe(false);
  });

  it('carries both once the cluster requires them', () => {
    const options = redisConnectionOptions(
      lookup({ REDIS_HOST: 'r', REDIS_PORT: '6380', REDIS_TLS: '1', REDIS_PASSWORD: 't' }),
    );

    expect(options).toEqual({ host: 'r', port: 6380, password: 't', tls: { servername: 'r' } });
  });
});
