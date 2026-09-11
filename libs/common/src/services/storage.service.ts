/**
 * StorageService - Abstraction for file storage S3
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

    // Disabling storage must be a choice, never an inference from absent
    // configuration. The previous gate required AWS_ACCESS_KEY_ID and
    // AWS_SECRET_ACCESS_KEY, which are not in the task definition and never
    // have been, so on Fargate the client was never built and every upload and
    // download silently returned an unusable URL with HTTP 200.
    if (this.transport === 'disabled') {
      this.s3 = null;
      this.logger.warn('STORAGE_TRANSPORT=disabled - S3 is off; storage calls will throw.');
      return;
    }

    // Misconfiguration is fatal at startup rather than at the first upload.
    if (!this.bucket || !this.region) {
      throw new Error(
        'StorageService: AWS_S3_BUCKET and AWS_S3_REGION are required when ' +
          "STORAGE_TRANSPORT is 's3'. Set them, or set STORAGE_TRANSPORT=disabled " +
          'to run without storage.',
      );
    }

    // No explicit credentials: the default provider chain resolves the ECS task
    // role on Fargate and the developer profile locally.
    this.s3 = new S3Client({
      region: this.region,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.logger.log(`S3 StorageService configured bucket=${this.bucket} region=${this.region}`);
  }

  /**
   * Fail loudly rather than returning a value the caller cannot distinguish
   * from a working one.
   */
  private assertEnabled(operation: string): S3Client {
    if (!this.s3) {
      throw new Error(`StorageService: cannot ${operation} because STORAGE_TRANSPORT=disabled.`);
    }
    return this.s3;
  }

  /**
   * Generate a presigned URL for uploading a file to S3 (PUT)
   * Frontend upload directly to s3 using this URL
   * @param key  - The S3 object key (e.g. "kbs/content/module1/lesson.pdf")
   * @param contentType - MIME type (e.g., 'image/jpeg', 'application/pdf')
   * @param expiresInSec - TTL for the presigned URL in seconds (default: 1800s = 30min)
   * @returns { uploadUrl: string; fileUrl: string }
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
   * Generate a presigned URL for downloading a file from S3 (GET)
   * @param key - The S3 object key (e.g. "kbs/content/module1/lesson.pdf")
   * @param expiresInSec - TTL for the presigned URL in seconds (default: 1800s = 30min)
   * @returns A presigned URL for downloading the file
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
   * Delete an object from S3
   * @param key - The S3 object key to delete (e.g. "kbs/content/module1/lesson.pdf")
   * @returns void
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
   * Every key under one prefix, following pagination to the end.
   *
   * C4c. Paging matters more than it looks: `ListObjectsV2` returns at most
   * 1000 keys per call, and a caller that reads the first page and stops
   * deletes some of somebody's documents and leaves the rest - which is a
   * worse state than not having tried, because the count it reports looks
   * like success.
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
   * Deletes every object under a prefix and returns how many went.
   *
   * **Throws if any key could not be deleted.** The caller - the purge - uses
   * that to decide whether to delete the database row, and a silent partial
   * success there is exactly how an orphan is made: the row goes, some objects
   * stay, and nothing anywhere records which.
   *
   * An empty prefix returns 0 rather than throwing, so the purge of a user who
   * never uploaded anything is not a special case.
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
          `Refusing to report success: ${errors.length} of ${batch.length} objects under ` +
            `"${prefix}" could not be deleted (${errors[0]?.Code}: ${errors[0]?.Message}). ` +
            `Nothing downstream may treat this prefix as cleared.`,
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
