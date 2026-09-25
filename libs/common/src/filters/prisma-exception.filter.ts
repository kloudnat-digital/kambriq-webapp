import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { GlobalExceptionFilter } from './global-exception.filter';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  /**
   * Delegates non-Prisma exceptions to the global fallback filter.
   * Prevents bypassing NestJS exception layer and leaking stack traces via Express.
   */
  private readonly fallback = new GlobalExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost): void {
    if (!this.isPrismaError(exception)) {
      this.fallback.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const prismaError = exception as {
      code: string;
      meta?: Record<string, unknown>;
      message: string;
    };
    const { status, message } = this.mapPrismaError(prismaError);

    this.logger.warn('Prisma Error %o', {
      code: prismaError.code,
      // Log path without query string to prevent sensitive token leakage. Preserves schema-safe Prisma messages.
      path: request.url.split('?')[0],
      message,
      status,
    });

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error: HttpStatus[status] || 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private isPrismaError(exception: unknown): boolean {
    if (typeof exception !== 'object' || exception === null) {
      return false;
    }
    const err = exception as Record<string, unknown>;
    return (
      typeof err['code'] === 'string' &&
      err['code'].startsWith('P') &&
      typeof err['message'] === 'string'
    );
  }

  private mapPrismaError(error: {
    code: string;
    meta?: Record<string, unknown>;
    message: string;
  }): { status: number; message: string } {
    switch (error.code) {
      // Unique constraint failed
      case 'P2002': {
        const target = (error.meta?.['target'] as string[])?.join(', ') || 'field';
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${target} already exists`,
        };
      }
      case 'P2025':
        // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        };
      case 'P2003': {
        // Foreign key constraint violation
        const field = (error.meta?.['field_name'] as string) || 'reference';
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Invalid reference: ${field}`,
        };
      }
      case 'P2004':
        // Required relation violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Missing required relation',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database operation failed',
        };
    }
  }
}
