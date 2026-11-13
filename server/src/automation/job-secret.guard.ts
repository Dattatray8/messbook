import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

export const JOB_SECRET_HEADER = 'x-job-secret';

const digest = (v: string) => createHash('sha256').update(v).digest();

/**
 * Authenticates the external scheduler (e.g. Render Cron Job) with a dedicated shared secret.
 * - Fails CLOSED: if BILLING_JOB_SECRET is not configured (any environment) the endpoint is off.
 * - Constant-time comparison over fixed-length digests (no length leak, no early exit).
 * - The secret is never logged or echoed.
 */
@Injectable()
export class JobSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.BILLING_JOB_SECRET;
    if (!expected || expected.length < 16) {
      throw new ServiceUnavailableException(
        'Scheduled jobs are not configured',
      );
    }
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = req.headers[JOB_SECRET_HEADER];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    if (!provided || !timingSafeEqual(digest(provided), digest(expected))) {
      throw new UnauthorizedException('Invalid job credentials');
    }
    return true;
  }
}
