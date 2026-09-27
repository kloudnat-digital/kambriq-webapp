import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeSignatureHeader, SIGNATURE_HEADER_NAME } from '@sanity/webhook';
import { SANITY_WEBHOOK_SECRET_VAR, SanityWebhookGuard } from '../../cms/sanity-webhook.guard';

/**
 * The signatures here are produced by `@sanity/webhook`'s own
 * `encodeSignatureHeader`, so what is exercised is the library's verification
 * rather than a second implementation of its scheme written to agree with the
 * first.
 */
const SECRET = 'a-webhook-secret-from-sanity';

const guardWith = (secret?: string) =>
  new SanityWebhookGuard({
    get: (key: string) => (key === SANITY_WEBHOOK_SECRET_VAR ? secret : undefined),
  } as unknown as ConfigService);

const contextFor = (request: unknown): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

const signedRequest = async (body: string, secret = SECRET) => ({
  headers: { [SIGNATURE_HEADER_NAME]: await encodeSignatureHeader(body, Date.now(), secret) },
  rawBody: Buffer.from(body, 'utf8'),
});

describe('SanityWebhookGuard', () => {
  const body = JSON.stringify({ _id: 'policy-fr', _rev: 'rev-1', slug: 'legal-privacy' });

  it('admits a delivery signed with the configured secret', async () => {
    await expect(
      guardWith(SECRET).canActivate(contextFor(await signedRequest(body))),
    ).resolves.toBe(true);
  });

  it('refuses a delivery signed with a different secret', async () => {
    const request = await signedRequest(body, 'not-the-configured-secret');

    await expect(guardWith(SECRET).canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a body altered after it was signed', async () => {
    // The signature covers the bytes, so one changed character invalidates it.
    const request = await signedRequest(body);
    request.rawBody = Buffer.from(body.replace('legal-privacy', 'legal-terms'), 'utf8');

    await expect(guardWith(SECRET).canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a delivery with no signature header', async () => {
    const request = { headers: {}, rawBody: Buffer.from(body, 'utf8') };

    await expect(guardWith(SECRET).canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a signature header that is not a single string', async () => {
    const request = {
      headers: { [SIGNATURE_HEADER_NAME]: ['t=1,v1=a', 't=2,v1=b'] },
      rawBody: Buffer.from(body, 'utf8'),
    };

    await expect(guardWith(SECRET).canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a malformed signature header rather than failing to answer', async () => {
    // A format error inside the library must surface as a refusal, not a 500.
    const request = {
      headers: { [SIGNATURE_HEADER_NAME]: 'not-a-signature-at-all' },
      rawBody: Buffer.from(body, 'utf8'),
    };

    await expect(guardWith(SECRET).canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a request with no raw body, instead of verifying the parsed one', async () => {
    // What `rawBody: true` missing from bootstrap looks like here.
    const request = {
      headers: { [SIGNATURE_HEADER_NAME]: await encodeSignatureHeader(body, Date.now(), SECRET) },
      body: JSON.parse(body),
    };

    await expect(guardWith(SECRET).canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  describe('when the secret is not configured', () => {
    /**
     * The direction that matters. An unset secret must not be read as "accept
     * anything", and it is reported as a server fault rather than as a bad
     * signature, because the signature was never the problem.
     */
    it.each([
      ['unset', undefined],
      ['empty', ''],
      ['whitespace', '   '],
    ])('refuses a correctly signed delivery when the secret is %s', async (_label, secret) => {
      const request = await signedRequest(body);

      await expect(guardWith(secret).canActivate(contextFor(request))).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
