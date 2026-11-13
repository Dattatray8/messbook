import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AutomationService } from './automation.service';
import {
  GenerateNowDto,
  UpdateAutomationSettingsDto,
} from './dto/automation.dto';

/** Owner-facing endpoints (session-authenticated by the global AuthGuard). */
@Controller('automation')
export class AutomationController {
  constructor(private readonly service: AutomationService) {}

  @Get('settings')
  settings(@CurrentUser() user: { id: string }) {
    return this.service.getSettings(user.id);
  }

  @Patch('settings')
  update(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAutomationSettingsDto,
  ) {
    return this.service.setEnabled(user.id, dto.enabled);
  }

  /** Manual generation: works whether or not automatic generation is enabled. */
  @Post('generate-now')
  generateNow(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateNowDto,
  ) {
    return this.service.generateNow(user.id, { dryRun: dto.dryRun });
  }

  @Get('runs')
  runs(@CurrentUser() user: { id: string }, @Query('limit') limit?: string) {
    return this.service.history(
      user.id,
      limit ? parseInt(limit, 10) || 20 : 20,
    );
  }
}
