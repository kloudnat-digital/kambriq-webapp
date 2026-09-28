import {
  isSnsUrl,
  parseSnsMessage,
  SnsMessageRejected,
  stringToSign,
  verifySnsSignature,
} from '../../../core/email-events/sns-message';
import { CERT_URL, PEM, signedNotification } from './sns-fixtures';

const fetchPem = jest.fn(async () => PEM);

beforeEach(() => fetchPem.mockClear());

describe('C24 - an SNS delivery is believed only when its signature verifies', () => {
  it('verifies a notification signed with SHA256 (SignatureVersion 2)', async () => {
    await expect(verifySnsSignature(signedNotification(), fetchPem)).resolves.toBeUndefined();
    expect(fetchPem).toHaveBeenCalledWith(CERT_URL);
  });

  it('verifies a notification signed with SHA1 (SignatureVersion 1)', async () => {
    await expect(
      verifySnsSignature(signedNotification({}, '1'), fetchPem),
    ).resolves.toBeUndefined();
  });

  it('refuses a message changed after it was signed', async () => {
    const tampered = { ...signedNotification(), Message: '{"eventType":"Complaint"}' };
    await expect(verifySnsSignature(tampered, fetchPem)).rejects.toThrow(
      'The SNS signature does not verify.',
    );
  });

  it('refuses a message that moves to another topic after it was signed', async () => {
    const moved = { ...signedNotification(), TopicArn: 'arn:aws:sns:eu-central-1:1:other' };
    await expect(verifySnsSignature(moved, fetchPem)).rejects.toThrow(SnsMessageRejected);
  });

  it.each([
    'https://sns.eu-central-1.amazonaws.com.evil.example/cert.pem',
    'http://sns.eu-central-1.amazonaws.com/cert.pem',
    'https://evil.example/sns.eu-central-1.amazonaws.com.pem',
    'https://s3.eu-central-1.amazonaws.com/cert.pem',
    'https://sns.eu-central-1.amazonaws.com/cert.txt',
  ])('never fetches a certificate from %s', async (url) => {
    await expect(
      verifySnsSignature(signedNotification({ SigningCertURL: url }), fetchPem),
    ).rejects.toThrow('The signing certificate is not served by SNS.');
    expect(fetchPem).not.toHaveBeenCalled();
  });

  it('refuses a signature version it does not know', async () => {
    await expect(
      verifySnsSignature({ ...signedNotification(), SignatureVersion: '3' }, fetchPem),
    ).rejects.toThrow('Unsupported SNS signature version.');
  });
});

describe('C24 - the signed string is the one SNS signs', () => {
  it('lists a notification without a subject in SNS order, subject omitted', () => {
    expect(stringToSign(signedNotification())).toBe(
      'Message\n{"eventType":"Bounce"}\nMessageId\nm-1\nTimestamp\n2026-09-28T08:00:00.000Z\n' +
        'TopicArn\narn:aws:sns:eu-central-1:051551940370:kambriq-dev-ses-events\nType\nNotification\n',
    );
  });

  it('includes the subscribe URL and token of a subscription confirmation, in order', () => {
    const s = stringToSign({
      ...signedNotification(),
      Type: 'SubscriptionConfirmation',
      SubscribeURL: 'https://sns.eu-central-1.amazonaws.com/?Action=ConfirmSubscription',
      Token: 't',
    });
    expect(s.split('\n').filter((_, i) => i % 2 === 0)).toEqual([
      'Message',
      'MessageId',
      'SubscribeURL',
      'Timestamp',
      'Token',
      'TopicArn',
      'Type',
      '',
    ]);
  });
});

describe('C24 - what is not an SNS message is refused before any signature work', () => {
  it.each([
    ['an object body', { Type: 'Notification' }],
    ['not JSON', 'Type=Notification'],
    ['an unknown type', JSON.stringify({ ...signedNotification(), Type: 'Other' })],
    ['a missing field', JSON.stringify({ ...signedNotification(), TopicArn: undefined })],
  ])('refuses %s', (_, body) => {
    expect(() => parseSnsMessage(body)).toThrow(SnsMessageRejected);
  });

  it('accepts a notification without a subject', () => {
    expect(parseSnsMessage(JSON.stringify(signedNotification())).Type).toBe('Notification');
  });

  it('recognises only https SNS hosts as SNS', () => {
    expect(isSnsUrl('https://sns.eu-central-1.amazonaws.com/x')).toBe(true);
    expect(isSnsUrl('https://sns.amazonaws.com.evil.example/x')).toBe(false);
    expect(isSnsUrl(undefined)).toBe(false);
  });
});
