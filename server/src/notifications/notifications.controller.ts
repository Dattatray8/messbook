import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
  UpdatePreferencesDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  /** GET /notifications?limit=30&before=<id> */
  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.service.list(user.id, {
      limit: limit ? parseInt(limit, 10) || undefined : undefined,
      before,
    });
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: { id: string }) {
    return { unreadCount: await this.service.unreadCount(user.id) };
  }

  @Get('preferences')
  preferences(@CurrentUser() user: { id: string }) {
    return this.service.getPreferences(user.id);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.service.updatePreferences(user.id, dto);
  }

  @Put('push-token')
  register(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.service.registerToken(user.id, dto);
  }

  @Delete('push-token')
  unregister(
    @CurrentUser() user: { id: string },
    @Body() dto: UnregisterPushTokenDto,
  ) {
    return this.service.unregisterToken(user.id, dto.deviceId);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: { id: string }) {
    return this.service.markAllRead(user.id);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.markRead(user.id, id);
  }
}
