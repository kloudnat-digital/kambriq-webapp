import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GetParameterCommand, GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
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
  notaryName: string;
  notaryPhone: string;
  notaryAddress: string;
  supportEmail: string;
  supportPhone: string;
};

/**
 * Parameter name -> field. The single place the mapping is written.
 *
 * **Nine, required at startup.** D9 removed `MOBILE_MONEY_OPERATOR`,
 * `MOBILE_MONEY_NUMBER` and `MOBILE_MONEY_NAME`: once OMO and MOMO each had
 * their own pair (`OPTIONAL_FIELDS`), no channel read them, and requiring them
 * here was the only thing keeping three dead parameters alive - deleting them
 * would have stopped the boot. They leave this map first; the parameters are
 * deleted in terraform only once an API without them has been seen running.
 */
const FIELDS: Record<keyof PaymentChannels, string> = {
  bankName: 'BANK_NAME',
  bankAccountName: 'BANK_ACCOUNT_NAME',
  bankIban: 'BANK_IBAN',
  bankSwift: 'BANK_SWIFT',
  notaryName: 'NOTARY_NAME',
  notaryPhone: 'NOTARY_PHONE',
  notaryAddress: 'NOTARY_ADDRESS',
  supportEmail: 'SUPPORT_EMAIL',
  supportPhone: 'SUPPORT_PHONE',
};

/**
 * Parameters that exist only for one channel, read on demand rather than at
 * startup.
 *
 * v03 splits mobile money into `OMO` (Orange) and `MOMO` (MTN) *"parce qu'ils
 * n'ont ni le meme numero, ni le meme format de confirmation, ni la meme
 * procedure en cas de litige"* - and its section 9 still describes **twelve**
 * required parameters, which carry a single, operator-agnostic mobile money
 * number. The two statements cannot both be satisfied: one number cannot be
 * two numbers.
 *
 * Rather than send the same number for both channels - which would make the
 * split decorative - each operator gets its own pair. They are **not** part of
 * the startup requirement, because making them so would refuse to start every
 * environment until infrastructure catches up, and an API that will not boot is
 * a worse answer than one that refuses one channel loudly.
 *
 * A send on a channel whose parameters are absent fails with their names. See
 * the register: an infra change is owed.
 */
const OPTIONAL_FIELDS: Record<string, string> = {
  orangeMoneyNumber: 'ORANGE_MONEY_NUMBER',
  orangeMoneyName: 'ORANGE_MONEY_NAME',
  mtnMoneyNumber: 'MTN_MONEY_NUMBER',
  mtnMoneyName: 'MTN_MONEY_NAME',
};

/**
 * Which details each channel's message carries. **Only these, never the rest.**
 *
 * v03 section 4d: *"Le message ne porte que les coordonnees de ce canal. Un
 * client qui paie par mobile money n'a pas besoin de l'IBAN, et ce qu'on ne
 * transmet pas ne peut etre ni recopie de travers ni transfere par erreur."*
 *
 * The support contact is on every message: a client who cannot make the channel
 * work needs somebody to call, whatever the channel.
 */
export const CHANNEL_FIELDS: Readonly<Record<string, readonly string[]>> = {
  VIR: ['bankName', 'bankAccountName', 'bankIban', 'bankSwift'],
  // A deposit is made at the counter of the same bank: the account it credits
  // is the same one, minus the SWIFT code, which is for international routing
  // and means nothing to somebody standing at a till in Douala.
  DEPO: ['bankName', 'bankAccountName', 'bankIban'],
  OMO: ['orangeMoneyNumber', 'orangeMoneyName'],
  MOMO: ['mtnMoneyNumber', 'mtnMoneyName'],
  // Cash in hand is arranged, not addressed: the client calls and a meeting is
  // fixed. Publishing an address here would invite somebody to arrive with cash
  // and find nobody expecting them.
  ESP: ['supportPhone', 'supportEmail'],
  NOTA: ['notaryName', 'notaryPhone', 'notaryAddress'],
};

const CACHE_TTL_MS = 60_000;

@Injectable()
export class PaymentChannelsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentChannelsService.name);
  private cached: { at: number; channels: PaymentChannels } | null = null;
  private optionalCache: { at: number; values: Record<string, string> } | null = null;
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

    /**
     * Both sets are counted, and the per-operator one is loaded here rather than
     * left to the first send.
     *
     * v03 section 9 says **sixteen** parameters. This line used to report
     * `fields: 12` - the size of the required set - so a correct apply that
     * landed all sixteen and a half-finished one that landed twelve produced
     * the same log, and the only way to tell them apart was to send an `OMO`
     * payment and watch it fail.
     *
     * `perOperator: 0` now says, at boot, that `OMO` and `MOMO` cannot be sent.
     * It is still not a startup failure: refusing to boot an environment because
     * two of six channels are unconfigured is worse than refusing those two
     * loudly, and the required nine are what the service genuinely cannot work
     * without.
     */
    const perOperator = Object.keys(await this.optional()).length;

    this.logger.log('Payment channel details loaded %o', {
      prefix: this.prefix(),
      required: Object.keys(FIELDS).length,
      perOperator,
      fields: Object.keys(FIELDS).length + perOperator,
    });

    if (perOperator < Object.keys(OPTIONAL_FIELDS).length) {
      this.logger.warn(
        `Only ${perOperator} of ${Object.keys(OPTIONAL_FIELDS).length} per-operator ` +
          // The **parameter** names, not the internal field keys: somebody
          // reading this log has to search SSM for them, and
          // `orangeMoneyNumber` is not a thing they can look up.
          `parameters are configured (${Object.values(OPTIONAL_FIELDS).join(', ')}). ` +
          `OMO and MOMO cannot be sent until they are - every other channel works.`,
      );
    }
  }

  /**
   * The details for **one** channel, and nothing else.
   *
   * v03 section 4d: *"Le message ne porte que les coordonnees de ce canal."*
   * A client paying by mobile money has no use for the IBAN, and what is not
   * transmitted can be neither miscopied nor forwarded by mistake.
   *
   * Returns a map keyed by field name, so a caller cannot accidentally spread
   * the whole set into a message: there is no object here that contains the
   * bank details *and* the notary's address.
   *
   * Throws, naming the parameters, when the chosen channel's details are not
   * configured. `OMO` and `MOMO` need their own operator parameters, which the
   * nine required ones do not include - see `OPTIONAL_FIELDS`.
   */
  async detailsFor(channel: string): Promise<Record<string, string>> {
    const fields = CHANNEL_FIELDS[channel];
    if (!fields) {
      throw new Error(
        `No channel details are defined for ${channel}. A channel that cannot say ` +
          `where the money goes must not be offered as a way to pay.`,
      );
    }

    const all = await this.get();
    const optional = await this.optional();

    const details: Record<string, string> = {};
    const missing: string[] = [];

    for (const field of fields) {
      const value =
        (all as unknown as Record<string, string>)[field] ?? optional[field] ?? undefined;
      if (!value || value.trim() === '') {
        missing.push(OPTIONAL_FIELDS[field] ?? FIELDS[field as keyof PaymentChannels] ?? field);
      } else {
        details[field] = value.trim();
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Refusing to send ${channel} instructions: ${missing.join(', ')} ` +
          `${missing.length === 1 ? 'is' : 'are'} not configured under ${this.prefix()}. ` +
          `A message with a blank where an account number belongs tells somebody to ` +
          `transfer money into nothing.`,
      );
    }

    // The support contact rides on every message: a client who cannot make the
    // channel work needs somebody to call, whichever channel it is.
    details['supportEmail'] = all.supportEmail;
    details['supportPhone'] = all.supportPhone;

    return details;
  }

  /** The per-operator parameters, absent by default. Cached with the rest. */
  private async optional(): Promise<Record<string, string>> {
    const prefix = this.prefix();
    if (!prefix) return {};
    if (this.optionalCache && Date.now() - this.optionalCache.at < CACHE_TTL_MS) {
      return this.optionalCache.values;
    }

    this.ssm ??= new SSMClient({ region: this.config.get<string>('AWS_REGION', 'eu-central-1') });
    const values: Record<string, string> = {};
    for (const [field, name] of Object.entries(OPTIONAL_FIELDS)) {
      try {
        const res = await this.ssm.send(
          new GetParameterCommand({ Name: `${prefix}/${name}`, WithDecryption: true }),
        );
        if (res.Parameter?.Value) values[field] = res.Parameter.Value;
      } catch {
        // Absent is the expected case until infrastructure adds them. It is not
        // an error here: it becomes one, by name, when a send needs the field.
      }
    }
    this.optionalCache = { at: Date.now(), values };
    return values;
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
