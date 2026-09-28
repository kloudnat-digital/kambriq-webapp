import { generateKeyPairSync, sign } from 'node:crypto';
import { stringToSign, type SnsMessage } from '../../../core/email-events/sns-message';

/** A key pair standing in for SNS's certificate; `PEM` is what a certificate fetch returns. */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
export const CERT_URL = 'https://sns.eu-central-1.amazonaws.com/SimpleNotificationService-abc.pem';

/** A notification signed the way SNS signs one. */
export const signedNotification = (over: Partial<SnsMessage> = {}, version = '2'): SnsMessage => {
  const base: SnsMessage = {
    Type: 'Notification',
    MessageId: 'm-1',
    TopicArn: 'arn:aws:sns:eu-central-1:051551940370:kambriq-dev-ses-events',
    Message: '{"eventType":"Bounce"}',
    Timestamp: '2026-09-28T08:00:00.000Z',
    SignatureVersion: version,
    Signature: '',
    SigningCertURL: CERT_URL,
    ...over,
  };
  const digest = version === '1' ? 'sha1' : 'sha256';
  return {
    ...base,
    Signature: sign(digest, Buffer.from(stringToSign(base)), privateKey).toString('base64'),
  };
};
