import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AutomationSettings,
  AutomationSettingsSchema,
  Notification,
  NotificationSchema,
  PushToken,
  PushTokenSchema,
} from '../core/schemas';
import { MessModule } from '../mess/mess.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Module({
  imports: [
    MessModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: PushToken.name, schema: PushTokenSchema },
      { name: AutomationSettings.name, schema: AutomationSettingsSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
