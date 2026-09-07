import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PaymentChannelsService } from '../../../lands/payments/payment-channels.service';

/**
 * G10 - the asymmetry, and the test that keeps it closed.
 *
 * An absent prefix used to **warn and return**; an empty parameter threw. That
 * is backwards, and it is not a theoretical complaint: it cost three deploys.
 * `PAYMENT_CHANNELS_SSM_PREFIX` was never in the ECS task definition, so on dev
 * that branch was taken every time, the SSM SDK was never called, and G3 looked
 * deployed while being configured on no environment at all. Nothing failed, so
 * nothing was looked at.
 *
 * The rule is `StorageService`'s: **disabling must be a choice, never an
 * inference from absent configuration.**
 */
const config = (values: Record<string, string | undefined>) =>
  ({
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  }) as unknown as ConfigService;

describe('G10 - an unconfigured payment channel service refuses to start', () => {
  it('throws when the prefix is absent and the transport is the default', async () => {
    // The exact shape dev was in for three deploys: no prefix, nothing set.
    const service = new PaymentChannelsService(config({}));

    await expect(service.onModuleInit()).rejects.toThrow(/PAYMENT_CHANNELS_SSM_PREFIX is required/);
  });

  it("throws when the prefix is absent and the transport is explicitly 'ssm'", async () => {
    const service = new PaymentChannelsService(config({ PAYMENT_CHANNELS_TRANSPORT: 'ssm' }));

    await expect(service.onModuleInit()).rejects.toThrow(/refusing to start/i);
  });

  it('throws when the prefix is present but blank, which is the same absence', async () => {
    const service = new PaymentChannelsService(config({ PAYMENT_CHANNELS_SSM_PREFIX: '   ' }));

    await expect(service.onModuleInit()).rejects.toThrow(/PAYMENT_CHANNELS_SSM_PREFIX is required/);
  });

  it('starts quietly only when disabling was asked for in words', async () => {
    const service = new PaymentChannelsService(config({ PAYMENT_CHANNELS_TRANSPORT: 'disabled' }));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('and even then it refuses to produce channel details rather than blanks', async () => {
    const service = new PaymentChannelsService(config({ PAYMENT_CHANNELS_TRANSPORT: 'disabled' }));
    await service.onModuleInit();

    // Disabled is not degraded-but-working. Nothing gets a message with a blank
    // where an account number belongs.
    await expect(service.get()).rejects.toThrow(/no payment channel details/i);
  });

  it('the unconfigured branch throws - it does not return', () => {
    /**
     * The behavioural tests above would all still pass if somebody restored the
     * early `return` **and** relaxed them. This reads the source, so the shape
     * of the fix is pinned and not only its current effect.
     *
     * What is asserted: there is exactly one `return` that ends `onModuleInit`
     * early, and it is inside the `disabled` branch. The absent-prefix branch
     * throws.
     */
    const src = readFileSync(
      join(__dirname, '..', '..', '..', 'lands', 'payments', 'payment-channels.service.ts'),
      'utf8',
    );
    const body = src.slice(src.indexOf('async onModuleInit('), src.indexOf('async get('));

    expect(body).toContain("this.transport() === 'disabled'");
    expect(body).toContain('this.prefix() === null');

    // The prefix check throws.
    const prefixBranch = body.slice(body.indexOf('this.prefix() === null'));
    expect(prefixBranch).toContain('throw new Error');
    expect(prefixBranch.slice(0, prefixBranch.indexOf('throw new Error'))).not.toContain('return');

    // And the only early return belongs to the branch somebody asked for.
    const disabledBranch = body.slice(
      body.indexOf("this.transport() === 'disabled'"),
      body.indexOf('this.prefix() === null'),
    );
    expect(disabledBranch).toContain('return;');
  });

  it('reports sixteen fields when all sixteen are configured, and says so when not', async () => {
    /**
     * v03 section 9 requires sixteen. The startup line used to report the size
     * of the *required* set - twelve - so a complete apply and a half-finished
     * one logged the same thing, and the only way to tell them apart was to send
     * an OMO payment and watch it fail.
     *
     * This is the line `G10b`'s post-apply checklist asks somebody to read, so
     * it has to mean what the checklist says it means.
     */
    const service = new PaymentChannelsService(
      config({ PAYMENT_CHANNELS_SSM_PREFIX: '/kambriq/test/api/payment-channels' }),
    );

    const logged: unknown[] = [];
    const warned: string[] = [];
    jest.spyOn(service['logger'], 'log').mockImplementation((...a: unknown[]) => {
      logged.push(a[1]);
    });
    jest.spyOn(service['logger'], 'warn').mockImplementation((m: unknown) => {
      warned.push(String(m));
    });

    // The twelve required load; the four per-operator ones are absent, which is
    // the state dev is in until G10b is applied.
    // `onModuleInit` calls `load`, not `get` - mocking the wrong one let the
    // real SSM read run and the test failed with twelve MISSING parameters.
    const internals = service as unknown as {
      load: () => Promise<unknown>;
      optional: () => Promise<Record<string, string>>;
    };
    jest.spyOn(internals, 'load').mockResolvedValue({});
    jest.spyOn(internals, 'optional').mockResolvedValue({});

    await service.onModuleInit();

    expect(logged[0]).toMatchObject({ required: 12, perOperator: 0, fields: 12 });
    expect(warned.join(' ')).toContain('OMO and MOMO cannot be sent');
    expect(warned.join(' ')).toContain('ORANGE_MONEY_NUMBER');
  });

  it('the transport variable is declared, so an environment cannot invent a third value', () => {
    const env = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        '..',
        'libs',
        'common',
        'src',
        'config',
        'env.validation.ts',
      ),
      'utf8',
    );
    expect(env).toContain("PAYMENT_CHANNELS_TRANSPORT: z.enum(['ssm', 'disabled']).default('ssm')");
  });
});
