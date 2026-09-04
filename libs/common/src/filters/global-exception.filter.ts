import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let error = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res['message'] as string) || message;
        error = (res['error'] as string) || error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error('@Unhandled exception %o', {
        message: exception.message,
        stack: exception.stack,
      });
    }

    const body = {
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      // No stack, ever, whatever NODE_ENV says. The stack is logged (see the
      // logger.error above), so the diagnostic already has a home; serving it to
      // an unauthenticated caller adds nothing. Gating on NODE_ENV made a single
      // misconfigured variable in prd an information leak, and a rule that
      // cannot misfire is worth more than the convenience it removes.
    };

    response.status(status).json(body);
  }
}
