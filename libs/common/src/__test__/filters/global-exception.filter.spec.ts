import { Logger, UnauthorizedException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../filters/global-exception.filter';

/**
 * A stack trace must never reach the HTTP response body, whatever NODE_ENV says.
 *
 * The stack is logged, so the diagnostic has a home. Serving it to an
 * unauthenticated caller adds nothing, and gating it on NODE_ENV turned a single
 * misconfigured variable in prd into an information leak. This test exists so a
 * rule that cannot misfire stays that way.
 */

const makeHost = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return {
    json,
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/v1/auth/login?token=secret' }),
      }),
    } as unknown as ArgumentsHost,
  };
};

const body = (exception: unknown): Record<string, unknown> => {
  const { json, host } = makeHost();
  new GlobalExceptionFilter().catch(exception, host);
  return json.mock.calls[0][0] as Record<string, unknown>;
};

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('GlobalExceptionFilter: no stack in the response body', () => {
  it.each(['development', 'production', 'test', ''])(
    'omits the stack when NODE_ENV is %s',
    (env) => {
      const prev = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = env;
      try {
        const out = body(new Error('boom at AuthService.login'));
        expect(out).not.toHaveProperty('stack');
        expect(JSON.stringify(out)).not.toContain('/app/dist/');
        expect(JSON.stringify(out)).not.toMatch(/\n\s+at /);
      } finally {
        process.env['NODE_ENV'] = prev;
      }
    },
  );

  it('a failed login exposes no frame and no file path', () => {
    const out = body(new UnauthorizedException('Veuillez vérifier votre adresse email'));
    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain('at AuthService.login');
    expect(serialised).not.toContain('main.js');
    expect(serialised).not.toContain('/app/');
  });

  it('still returns the useful parts', () => {
    const out = body(new UnauthorizedException('Nope'));
    expect(out).toMatchObject({ success: false, statusCode: 401, message: 'Nope' });
    expect(out).toHaveProperty('timestamp');
  });
});
