/**
 * Abstraction for Amazon S3 file storage.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly transport: 's3' | 'disabled';

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET', '');
    this.region = this.config.get<string>('AWS_S3_REGION', '');
    this.transport =
      this.config.get<string>('STORAGE_TRANSPORT', 's3') === 'disabled' ? 'disabled' : 's3';

    // Disabling storage must be explicitly configured.
    // Incomplete configuration results in fatal startup errors rather than silent failures.
    if (this.transport === 'disabled') {
      this.s3 = null;
      this.logger.warn('STORAGE_TRANSPORT=disabled - S3 is off; storage calls will throw.');
      return;
    }

    // Validate required configuration parameters.
    if (!this.bucket || !this.region) {
      throw new Error(
        'StorageService: AWS_S3_BUCKET and AWS_S3_REGION are required when ' +
          "STORAGE_TRANSPORT is 's3'. Set them, or set STORAGE_TRANSPORT=disabled " +
          'to run without storage.',
      );
    }

    // The default credential provider chain resolves the ECS task role on Fargate
    // and the local developer profile automatically.
    this.s3 = new S3Client({
      region: this.region,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.logger.log(`S3 StorageService configured bucket=${this.bucket} region=${this.region}`);
  }

  /**
   * Ensures the S3 client is enabled before executing an operation.
   * Throws an error if storage transport is disabled.
   */
  private assertEnabled(operation: string): S3Client {
    if (!this.s3) {
      throw new Error(`StorageService: cannot ${operation} because STORAGE_TRANSPORT=disabled.`);
    }
    return this.s3;
  }

  /**
   * Generates a presigned URL for uploading a file to S3 (PUT).
   *
   * @param key - The S3 object key.
   * @param contentType - The MIME type of the file.
   * @param expiresInSec - TTL for the presigned URL in seconds.
   * @returns An object containing the upload URL and the file URL.
   */
  async getUploadUrl(
    key: string,
    contentType: string,
    expiresInSec = 1800,
  ): Promise<{ uploadUrl: string; fileUrl: string }> {
    const s3 = this.assertEnabled('create an upload URL');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: expiresInSec,
    });

    return { uploadUrl, fileUrl: key };
  }

  /**
   * Generates a presigned URL for downloading a file from S3 (GET).
   *
   * @param key - The S3 object key.
   * @param expiresInSec - TTL for the presigned URL in seconds.
   * @returns A presigned URL for downloading the file.
   */
  async getDownloadUrl(key: string, expiresInSec = 1800): Promise<string> {
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }

    const s3 = this.assertEnabled('create a download URL');

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(s3, command, { expiresIn: expiresInSec });
  }

  /**
   * Deletes an object from S3.
   *
   * @param key - The S3 object key to delete.
   */
  async deleteObject(key: string): Promise<void> {
    const s3 = this.assertEnabled('delete an object');

    await s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log(`Deleted S3 object key=${key}`);
  }

  /**
   * Lists all keys under a specified prefix.
   * Automatically handles pagination to retrieve all matching keys.
   *
   * @param prefix - The prefix to search for.
   * @returns An array of S3 object keys.
   */
  async listKeys(prefix: string): Promise<string[]> {
    const s3 = this.assertEnabled('list objects');
    const keys: string[] = [];
    let token: string | undefined;

    do {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const o of page.Contents ?? []) if (o.Key) keys.push(o.Key);
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return keys;
  }

  /**
   * Deletes all objects under a specified prefix.
   * Throws an error if any deletion fails to prevent orphaned objects.
   * Returns 0 for an empty prefix.
   *
   * @param prefix - The prefix to clear.
   * @returns The number of deleted objects.
   */
  async deletePrefix(prefix: string): Promise<number> {
    const s3 = this.assertEnabled('delete a prefix');
    const keys = await this.listKeys(prefix);
    if (keys.length === 0) return 0;

    let deleted = 0;
    // S3 takes at most 1000 keys per DeleteObjects call.
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      const res = await s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
        }),
      );
      const errors = res.Errors ?? [];
      if (errors.length > 0) {
        throw new Error(
          `Failed to delete ${errors.length} of ${batch.length} objects under ` +
            `"${prefix}" (${errors[0]?.Code}: ${errors[0]?.Message}).`,
        );
      }
      deleted += res.Deleted?.length ?? 0;
    }

    this.logger.log(`Deleted ${deleted} object(s) under prefix=${prefix}`);
    return deleted;
  }

  /**
   * Build a hierarchical S3 key path.
   * @example buildKey('kbs', 'content', 'module1', 'lesson.pdf')
   * → "kbs/content/module1/lesson.pdf"
   */
  buildKey(...parts: string[]): string {
    return parts.filter(Boolean).join('/');
  }
}
