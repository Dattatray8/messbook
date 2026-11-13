import { Controller, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AutomationService } from './automation.service';
import { JobSecretGuard } from './job-secret.guard';

/**
 * Internal entry point for an EXTERNAL scheduler (Render Cron Job).
 * Public to the session guard, but protected by the dedicated job secret.
 *
 *   POST /api/internal/jobs/billing/run            (header: x-job-secret)
 *   POST /api/internal/jobs/billing/run?dryRun=true  -> reports counts, creates nothing
 */
@Public()
@UseGuards(JobSecretGuard)
@Controller('internal/jobs/billing')
export class InternalJobsController {
  constructor(private readonly service: AutomationService) {}

  @Post('run')
  @HttpCode(200)
  run(@Query('dryRun') dryRun?: string) {
    return this.service.runScheduled({ dryRun: dryRun === 'true' });
  }
}
