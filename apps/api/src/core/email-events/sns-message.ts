import { createPublicKey, verify } from 'node:crypto';

/**
 * An Amazon SNS HTTP(S) delivery, as SNS posts it (`Content-Type: text/plain`).
 *
 * Verification follows the SNS documentation: the signed string is built from a
 * fixed list of fields per message type, in that order, each as `Name\nValue\n`;
 * the signature is RSA over that string with SHA1 (`SignatureVersion` 1) or
 * SHA256 (2), checked against the certificate at `SigningCertURL`. The
 * certificate is fetched only from an `https://sns.<region>.amazonaws.com/*.pem`
 * URL, since a message that names its own certificate host could sign itself.
 */
export type SnsMessageType =
  | 'Notification'
  | 'SubscriptionConfirmation'
  | 'UnsubscribeConfirmation';

export interface SnsMessage {
  Type: SnsMessageType;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
}

export class SnsMessageRejected extends Error {}

const SIGNED_FIELDS: Record<SnsMessageType, (keyof SnsMessage)[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
  UnsubscribeConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
};

const DIGEST: Record<string, string> = { '1': 'sha1', '2': 'sha256' };

/** An SNS endpoint host: `sns.<region>.amazonaws.com`, over HTTPS. */
export const isSnsUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname);
};

/** Parses a delivery body into an SNS message, refusing anything that is not one. */
export const parseSnsMessage = (body: unknown): SnsMessage => {
  if (typeof body !== 'string') throw new SnsMessageRejected('The body is not an SNS message.');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new SnsMessageRejected('The body is not JSON.');
  }
  const type = parsed['Type'];
  if (typeof type !== 'string' || !(type in SIGNED_FIELDS)) {
    throw new SnsMessageRejected('Unknown SNS message type.');
  }
  for (const field of SIGNED_FIELDS[type as SnsMessageType].filter((f) => f !== 'Subject')) {
    if (typeof parsed[field] !== 'string') {
      throw new SnsMessageRejected(`Missing SNS field ${field}.`);
    }
  }
  for (const field of ['SignatureVersion', 'Signature', 'SigningCertURL']) {
    if (typeof parsed[field] !== 'string') {
      throw new SnsMessageRejected(`Missing SNS field ${field}.`);
    }
  }
  return parsed as unknown as SnsMessage;
};

/** The exact string SNS signed for this message. */
export const stringToSign = (message: SnsMessage): string =>
  SIGNED_FIELDS[message.Type]
    .filter((field) => message[field] !== undefined)
    .map((field) => `${field}\n${message[field]}\n`)
    .join('');

/**
 * Verifies the message's signature against the certificate SNS names, fetched
 * through `fetchCertificate`. Throws `SnsMessageRejected` on any failure.
 */
export const verifySnsSignature = async (
  message: SnsMessage,
  fetchCertificate: (url: string) => Promise<string>,
): Promise<void> => {
  const digest = DIGEST[message.SignatureVersion];
  if (!digest) throw new SnsMessageRejected('Unsupported SNS signature version.');

  if (
    !isSnsUrl(message.SigningCertURL) ||
    !new URL(message.SigningCertURL).pathname.endsWith('.pem')
  ) {
    throw new SnsMessageRejected('The signing certificate is not served by SNS.');
  }

  const key = createPublicKey(await fetchCertificate(message.SigningCertURL));
  const valid = verify(
    digest,
    Buffer.from(stringToSign(message), 'utf8'),
    key,
    Buffer.from(message.Signature, 'base64'),
  );
  if (!valid) throw new SnsMessageRejected('The SNS signature does not verify.');
};
