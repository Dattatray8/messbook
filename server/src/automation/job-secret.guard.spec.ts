import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JobSecretGuard } from './job-secret.guard';

const ctx = (headers: Record<string, any>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as any;

describe('JobSecretGuard', () => {
  const guard = new JobSecretGuard();
  const original = process.env.BILLING_JOB_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.BILLING_JOB_SECRET;
    else process.env.BILLING_JOB_SECRET = original;
  });

  it('fails closed when the secret is not configured', () => {
    delete process.env.BILLING_JOB_SECRET;
    expect(() =>
      guard.canActivate(ctx({ 'x-job-secret': 'anything' })),
    ).toThrow(ServiceUnavailableException);
  });

  it('fails closed when the configured secret is too short to be safe', () => {
    process.env.BILLING_JOB_SECRET = 'short';
    expect(() => guard.canActivate(ctx({ 'x-job-secret': 'short' }))).toThrow(
      ServiceUnavailableException,
    );
  });

  describe('with a configured secret', () => {
    beforeEach(() => {
      process.env.BILLING_JOB_SECRET = 'a-long-enough-test-secret-0123456789';
    });

    it('rejects a missing header', () => {
      expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
    });
    it('rejects an empty header', () => {
      expect(() => guard.canActivate(ctx({ 'x-job-secret': '' }))).toThrow(
        UnauthorizedException,
      );
    });
    it('rejects a wrong secret (including a different length)', () => {
      expect(() => guard.canActivate(ctx({ 'x-job-secret': 'nope' }))).toThrow(
        UnauthorizedException,
      );
      expect(() =>
        guard.canActivate(
          ctx({ 'x-job-secret': 'a-long-enough-test-secret-0123456780' }),
        ),
      ).toThrow(UnauthorizedException);
    });
    it('accepts the correct secret', () => {
      expect(
        guard.canActivate(
          ctx({ 'x-job-secret': 'a-long-enough-test-secret-0123456789' }),
        ),
      ).toBe(true);
    });
    it('does not accept a user session cookie in place of the secret', () => {
      expect(() => guard.canActivate(ctx({ cookie: 'session=abc' }))).toThrow(
        UnauthorizedException,
      );
    });
  });
});
