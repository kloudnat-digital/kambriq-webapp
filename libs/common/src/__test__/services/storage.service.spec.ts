import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation((config: unknown) => ({
    config,
    send: mockSend,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ kind: 'put', input })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ kind: 'get', input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ kind: 'del', input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed.example/presigned?X-Amz-Signature=abc'),
}));

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from '../../services/storage.service';

const S3ClientMock = S3Client as unknown as jest.Mock;
const DeleteObjectCommandMock = DeleteObjectCommand as unknown as jest.Mock;
const getSignedUrlMock = getSignedUrl as unknown as jest.Mock;

const BASE = { AWS_S3_BUCKET: 'kambriq-media-dev', AWS_S3_REGION: 'eu-central-1' };

const make = (values: Record<string, string> = BASE) =>
  new StorageService({
    get: jest.fn((key: string, fallback?: string) => (key in values ? values[key] : fallback)),
  } as unknown as ConfigService);

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockResolvedValue({});
  getSignedUrlMock.mockResolvedValue('https://signed.example/presigned?X-Amz-Signature=abc');
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('StorageService: client construction', () => {
  // The bug: the client was built only when AWS_ACCESS_KEY_ID and
  // AWS_SECRET_ACCESS_KEY were both present. They are not in the task
  // definition, so on Fargate S3 was never enabled.
  it('constructs the client when no static credentials are present', () => {
    make();
    expect(S3ClientMock).toHaveBeenCalledTimes(1);
    expect(S3ClientMock.mock.calls[0][0]).toMatchObject({ region: 'eu-central-1' });
  });

  it('passes no credentials, leaving the default provider chain to resolve them', () => {
    make();
    expect(S3ClientMock.mock.calls[0][0]).not.toHaveProperty('credentials');
  });

  it('ignores static credentials even when they are set', () => {
    make({ ...BASE, AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE', AWS_SECRET_ACCESS_KEY: 'secret' });
    expect(S3ClientMock.mock.calls[0][0]).not.toHaveProperty('credentials');
  });
});

describe('StorageService: misconfiguration is fatal at startup', () => {
  it.each([
    ['bucket', { AWS_S3_REGION: 'eu-central-1' }],
    ['region', { AWS_S3_BUCKET: 'kambriq-media-dev' }],
    ['both', {}],
  ])('throws when %s is missing', (_label, values) => {
    expect(() => make(values as Record<string, string>)).toThrow(
      /AWS_S3_BUCKET and AWS_S3_REGION are required/,
    );
    expect(S3ClientMock).not.toHaveBeenCalled();
  });
});

describe('StorageService: presigned URLs, never placeholders', () => {
  it('returns a presigned upload URL, not a public one', async () => {
    const service = make();
    const { uploadUrl, fileUrl } = await service.getUploadUrl('kbs/a.pdf', 'application/pdf');

    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(uploadUrl).toContain('X-Amz-Signature');
    expect(uploadUrl).not.toContain('kambriq-media-dev.s3.');
    expect(fileUrl).toBe('kbs/a.pdf');
  });

  it('returns a presigned download URL, not a public one', async () => {
    const service = make();
    const url = await service.getDownloadUrl('kbs/a.pdf');

    expect(url).toContain('X-Amz-Signature');
    expect(url).not.toContain('kambriq-media-dev.s3.');
  });

  it('passes an absolute URL through untouched', async () => {
    const service = make();
    await expect(service.getDownloadUrl('https://cdn.example/x.png')).resolves.toBe(
      'https://cdn.example/x.png',
    );
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it('actually deletes rather than warning and returning', async () => {
    const service = make();
    await service.deleteObject('kbs/a.pdf');

    expect(DeleteObjectCommandMock).toHaveBeenCalledWith({
      Bucket: 'kambriq-media-dev',
      Key: 'kbs/a.pdf',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe('StorageService: disabled transport is explicit and loud', () => {
  const disabled = () => make({ ...BASE, STORAGE_TRANSPORT: 'disabled' });

  it('builds no client when explicitly disabled', () => {
    disabled();
    expect(S3ClientMock).not.toHaveBeenCalled();
  });

  it.each([
    ['getUploadUrl', (s: StorageService) => s.getUploadUrl('k', 'text/plain')],
    ['getDownloadUrl', (s: StorageService) => s.getDownloadUrl('k')],
    ['deleteObject', (s: StorageService) => s.deleteObject('k')],
  ])('%s throws instead of returning a success-shaped value', async (_label, call) => {
    await expect(call(disabled())).rejects.toThrow(/STORAGE_TRANSPORT=disabled/);
  });

  // The regression guard: absent credentials must not disable storage.
  it.each([
    ['unset', BASE],
    ['s3', { ...BASE, STORAGE_TRANSPORT: 's3' }],
    ['an unrecognised value', { ...BASE, STORAGE_TRANSPORT: 'local' }],
  ])('stays enabled when STORAGE_TRANSPORT is %s', async (_label, values) => {
    const service = make(values as Record<string, string>);
    await expect(service.getDownloadUrl('k')).resolves.toContain('X-Amz-Signature');
  });
});
