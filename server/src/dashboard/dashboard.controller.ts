import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessService } from '../mess/mess.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly messService: MessService,
  ) {}

  @Get()
  async overview(@CurrentUser() user: { id: string }) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.dashboardService.overview(messId);
  }
}
