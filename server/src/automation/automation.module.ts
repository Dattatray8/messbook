import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillsModule } from '../bills/bills.module';
import {
  AutomationRun,
  AutomationRunSchema,
  AutomationSettings,
  AutomationSettingsSchema,
  Customer,
  CustomerSchema,
} from '../core/schemas';
import { MessModule } from '../mess/mess.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { InternalJobsController } from './internal-jobs.controller';
import { JobSecretGuard } from './job-secret.guard';

@Module({
  imports: [
    BillsModule,
    MessModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: AutomationSettings.name, schema: AutomationSettingsSchema },
      { name: AutomationRun.name, schema: AutomationRunSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [AutomationController, InternalJobsController],
  providers: [AutomationService, JobSecretGuard],
})
export class AutomationModule {}
