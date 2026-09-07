import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import { ConfigService } from '@nestjs/config';

/**
 * G3 - where the money can actually be sent, read from SSM at runtime.
 *
 * **These are business data, not code.** A bank account number, a mobile money
 * number and a notary's contact change without anybody deploying anything, and
 * a wrong one sends a client's money to the wrong place. They are not in the
 * repository and not in a seed.
 *
 * ---------------------------------------------------------------------------
 * Which reader, and what that buys
 * ---------------------------------------------------------------------------
 * **The SSM SDK, at runtime, with a short cache.** Not the task definition.
 *
 * `B3` established that only 7 of the 56 parameters on dev reach the container
 * as ECS `secrets`; the other 49 are plain `environment` values that terraform
 * rendered **at apply time**. For those, `aws ssm put-parameter --overwrite`
 * changes nothing in the running system until somebody applies terraform again.
 *
 * A wrong account number must be correctable in the time it takes to type one
 * command. So these are read the way `prisma/bootstrap-admins.ts` reads its
 * identities - through the SDK, against `/kambriq/{env}/api/payment-channels` -
 * and cached for `CACHE_TTL_MS`. **A correction takes effect within a minute
 * and needs no deploy.**
 *
 * ---------------------------------------------------------------------------
 * Nothing is optional
 * ---------------------------------------------------------------------------
 * Every parameter below is required. A missing one fails at **startup**, naming
 * every parameter that is absent rather than the first, and the module refuses
 * to come up. A blank where an account number belongs is not a degraded
 * message - it is a message that tells somebody to transfer money into nothing.
 *
 * **And so is the prefix (G10).** An absent `PAYMENT_CHANNELS_SSM_PREFIX` fails
 * the boot exactly as an empty parameter does. Running without channels is set
 * with `PAYMENT_CHANNELS_TRANSPORT=disabled`, which is a sentence somebody wrote
 * rather than a variable somebody forgot.
 */
export type PaymentChannels = {
  bankName: string;
  bankAccountName: string;
  bankIban: string;
  bankSwift: string;
  mobileMoneyOperator: string;
  mobileMoneyNumber: string;
  mobileMoneyName: string;
  notaryName: string;
  notaryPhone: string;
  notaryAddress: string;
  supportEmail: string;
  supportPhone: string;
};

/** Parameter name -> field. The single place the mapping is written. */
const FIELDS: Record<keyof PaymentChannels, string> = {
  bankName: 'BANK_NAME',
  bankAccountName: 'BANK_ACCOUNT_NAME',
  bankIban: 'BANK_IBAN',
  bankSwift: 'BANK_SWIFT',
  mobileMoneyOperator: 'MOBILE_MONEY_OPERATOR',
  mobileMoneyNumber: 'MOBILE_MONEY_NUMBER',
  mobileMoneyName: 'MOBILE_MONEY_NAME',
  notaryName: 'NOTARY_NAME',
  notaryPhone: 'NOTARY_PHONE',
  notaryAddress: 'NOTARY_ADDRESS',
  supportEmail: 'SUPPORT_EMAIL',
  supportPhone: 'SUPPORT_PHONE',
};

const CACHE_TTL_MS = 60_000;

@Injectable()
export class PaymentChannelsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentChannelsService.name);
  private cached: { at: number; channels: PaymentChannels } | null = null;
  private ssm: SSMClient | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Fails the boot rather than the first payment.
   *
   * A missing bank detail discovered when a client asks why their instructions
   * are blank is the same defect as a null SES client: found by a person, in
   * production, long after it could have been cheap.
   */
  async onModuleInit(): Promise<void> {
    /**
     * G10 - the asymmetry, corrected.
     *
     * This used to warn and **return** when the prefix was absent, and throw
     * when the prefix was present but a parameter was empty. That is backwards.
     * An empty parameter is one wrong value; an absent prefix is a service that
     * knows nothing at all - and it was the quiet one.
     *
     * It cost three deploys. `PAYMENT_CHANNELS_SSM_PREFIX` was never added to
     * the ECS task definition, so on dev this branch was taken every time, the
     * SDK was never called, and G3 looked deployed while being configured on no
     * environment. Nothing failed, so nothing was looked at.
     *
     * The rule is `StorageService`'s, applied here: **disabling must be a
     * choice, never an inference from absent configuration.** Running without
     * channel details is legitimate - locally, in tests, in any environment that
     * never sends instructions - and it now has to be said out loud.
     */
    if (this.transport() === 'disabled') {
      this.logger.warn(
        'PAYMENT_CHANNELS_TRANSPORT=disabled - payment channel details are off. ' +
          'Instructions cannot be sent, and any attempt to send one will throw ' +
          'rather than produce a message with blanks.',
      );
      return;
    }

    if (this.prefix() === null) {
      throw new Error(
        'PaymentChannelsService: PAYMENT_CHANNELS_SSM_PREFIX is required when ' +
          "PAYMENT_CHANNELS_TRANSPORT is 'ssm'. Set it to the parameter prefix " +
          '(for example /kambriq/dev/api/payment-channels), or set ' +
          'PAYMENT_CHANNELS_TRANSPORT=disabled to run without payment channels. ' +
          'Refusing to start: a service that silently knows no channel details is ' +
          'how G3 reached dev configured on no environment at all.',
      );
    }

    await this.load();
    this.logger.log('Payment channel details loaded %o', {
      prefix: this.prefix(),
      fields: Object.keys(FIELDS).length,
    });
  }

  /** The channels, from cache when fresh. Throws rather than returning blanks. */
  async get(): Promise<PaymentChannels> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.channels;
    }
    return this.load();
  }

  private prefix(): string | null {
    // Trimmed before anything else: `PAYMENT_CHANNELS_SSM_PREFIX="   "` is a
    // variable somebody set to nothing, and it used to read as configured -
    // passing the startup check and failing later inside the SDK with a message
    // about a malformed path. Whitespace is absence.
    const raw = this.config.get<string>('PAYMENT_CHANNELS_SSM_PREFIX')?.trim();
    return raw ? raw.replace(/\/+$/, '') || null : null;
  }

  /** `'ssm'` by default. Turning it off is a decision somebody typed. */
  private transport(): 'ssm' | 'disabled' {
    return this.config.get<string>('PAYMENT_CHANNELS_TRANSPORT', 'ssm') === 'disabled'
      ? 'disabled'
      : 'ssm';
  }

  private async load(): Promise<PaymentChannels> {
    const prefix = this.prefix();
    if (!prefix) {
      throw new Error(
        'There are no payment channel details: PAYMENT_CHANNELS_SSM_PREFIX is not set ' +
          '(or PAYMENT_CHANNELS_TRANSPORT=disabled). Refusing to build payment ' +
          'instructions: a message with a blank where an account number belongs tells ' +
          'somebody to transfer money into nothing.',
      );
    }

    this.ssm ??= new SSMClient({ region: this.config.get<string>('AWS_REGION', 'eu-central-1') });

    const found = new Map<string, string>();
    let nextToken: string | undefined;
    do {
      const page = await this.ssm.send(
        new GetParametersByPathCommand({
          Path: prefix,
          Recursive: true,
          WithDecryption: true,
          NextToken: nextToken,
        }),
      );
      for (const p of page.Parameters ?? []) {
        if (p.Name && p.Value !== undefined) found.set(p.Name, p.Value);
      }
      nextToken = page.NextToken;
    } while (nextToken);

    const channels = {} as PaymentChannels;
    const missing: string[] = [];
    const blank: string[] = [];

    for (const [field, name] of Object.entries(FIELDS) as [keyof PaymentChannels, string][]) {
      const value = found.get(`${prefix}/${name}`);
      if (value === undefined) missing.push(`${prefix}/${name}`);
      // A parameter created and never filled reads as present to anything that
      // only checks existence. It is a different mistake and it is named as one.
      else if (value.trim() === '') blank.push(`${prefix}/${name}`);
      else channels[field] = value.trim();
    }

    if (missing.length > 0 || blank.length > 0) {
      throw new Error(
        [
          `Payment channel details are incomplete: ${missing.length + blank.length} parameter(s) unusable.`,
          ...missing.map((n) => `  MISSING  ${n}`),
          ...blank.map((n) => `  EMPTY    ${n}`),
          '',
          'No payment instruction will be sent until every one is present. A blank where an',
          'account number belongs is worse than no message at all.',
        ].join('\n'),
      );
    }

    this.cached = { at: Date.now(), channels };
    return channels;
  }
}
