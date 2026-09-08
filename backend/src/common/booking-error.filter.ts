import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DomainException, DomainRateLimitException } from './domain-error';

@Catch(DomainException)
export class BookingErrorFilter implements ExceptionFilter {
  catch(error: DomainException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const body = error.getResponse() as { code?: string };
    if (body.code === 'SLOT_LOCKED_RETRY') response.setHeader('Retry-After', '1');
    if (error instanceof DomainRateLimitException) response.setHeader('Retry-After', String(error.retryAfterSeconds));
    response.status(error.getStatus()).json({ statusCode: error.getStatus(), ...body });
  }
}
