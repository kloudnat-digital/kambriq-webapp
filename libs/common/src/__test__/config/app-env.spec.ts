import {
  apiLogLevel,
  appEnvironment,
  isLocalEnvironment,
  prettyLogs,
  prismaLogLevels,
} from '../../config/app-env';
import { servesApiDocs } from '../../config/api-docs';

/**
 * A48 - every environment decision, from APP_ENV. Local turns the developer's
 * conveniences on; anything else - including nothing declared, which is what
 * dev has today - gets the quiet behaviour.
 */
const env = (e: Record<string, string>) => e as NodeJS.ProcessEnv;

describe.each([
  ['nothing declared, as on dev today', env({})],
  ['a development build, which dev also is', env({ NODE_ENV: 'development' })],
  ['dev', env({ APP_ENV: 'dev' })],
  ['production', env({ APP_ENV: 'production' })],
])('A48 - %s', (_what, e) => {
  it('logs no SQL', () => expect(prismaLogLevels(e)).toEqual(['error']));
  it('logs at info, as JSON', () => {
    expect(apiLogLevel(e)).toBe('info');
    expect(prettyLogs(e)).toBe(false);
  });
  it('serves no API documentation', () => expect(servesApiDocs(e)).toBe(false));
});

describe('A48 - APP_ENV=local', () => {
  const local = env({ APP_ENV: ' Local ', NODE_ENV: 'production' });
  it('is local however it is written, and whatever NODE_ENV says', () => {
    expect(appEnvironment(local)).toBe('local');
    expect(isLocalEnvironment(local)).toBe(true);
  });
  it("keeps a developer's conveniences", () => {
    expect(prismaLogLevels(local)).toContain('query');
    expect(apiLogLevel(local)).toBe('debug');
    expect(prettyLogs(local)).toBe(true);
    expect(servesApiDocs(local)).toBe(true);
  });
  it('reports nothing declared as null', () =>
    expect(appEnvironment(env({ APP_ENV: '  ' }))).toBeNull());
});
