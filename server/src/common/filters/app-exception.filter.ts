import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Turns Mongoose cast/validation errors into proper 400s instead of 500s. */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      return res
        .status(exception.getStatus())
        .json(typeof body === 'string' ? { message: body } : body);
    }

    const err = exception as { name?: string; message?: string };
    if (err?.name === 'CastError') {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ statusCode: 400, message: 'Invalid id' });
    }
    if (err?.name === 'ValidationError') {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ statusCode: 400, message: err.message });
    }

    this.logger.error(
      err?.message ?? 'Unknown error',
      (exception as Error)?.stack,
    );
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: 500, message: 'Internal server error' });
  }
}
