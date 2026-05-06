/**
 * StorageService - Abstraction for file storage S3
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket?: string;
  private readonly region?: string;
  private readonly accessKeyId?: string;
  private readonly secretAccessKey?: string;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET');
    this.region = this.config.get<string>('AWS_S3_REGION');
    this.accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    this.secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (this.bucket && this.region && this.accessKeyId && this.secretAccessKey) {
      this.s3 = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });

      this.isConfigured = true;
      this.logger.log('S3 StorageService configured', {
        bucket: this.bucket,
        region: this.region,
      });
    } else {
      this.s3 = null;
      this.isConfigured = false;
      this.logger.warn('S3 StorageService not configured', {
        bucket: this.bucket,
        region: this.region,
        accessKeyId: !!this.accessKeyId,
        secretAccessKey: !!this.secretAccessKey,
      });
    }
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
    if (!this.isConfigured || !this.s3) {
      return { uploadUrl: this.getPublicUrl(key), fileUrl: key };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: expiresInSec,
    });

    return { uploadUrl, fileUrl: key };
  }

  /**
   * Generate a presigned URL for downloading a file from S3 (GET)
   * @param key - The S3 object key (e.g. "kbs/content/module1/lesson.pdf")
   * @param expiresInSec - TTL for the presigned URL in seconds (default: 1800s = 30min)
   * @returns A presigned URL for downloading the file, or the public URL if S3 is not configured
   */
  async getDownloadUrl(key: string, expiresInSec = 1800): Promise<string> {
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }

    if (!this.isConfigured || !this.s3) {
      return this.getPublicUrl(key);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3, command, { expiresIn: expiresInSec });
  }

  /**
   * Delete an object from S3
   * @param key - The S3 object key to delete (e.g. "kbs/content/module1/lesson.pdf")
   * @returns void
   */
  async deleteObject(key: string): Promise<void> {
    if (!this.isConfigured || !this.s3) {
      this.logger.warn('S3 not configured - Cannot delete object', { key });
      return;
    }

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log('Deleted S3 object', { key });
  }

  /**
   * Build a hierarchical S3 key path.
   * @example buildKey('kbs', 'content', 'module1', 'lesson.pdf')
   * → "kbs/content/module1/lesson.pdf"
   */
  buildKey(...parts: string[]): string {
    return parts.filter(Boolean).join('/');
  }

  /**
   * Get the public URL for an s3 object
   */
  private getPublicUrl(key: string): string {
    return `https://${this.bucket || 'mock-bucket'}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
