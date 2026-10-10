import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bill,
  BillSchema,
  Customer,
  CustomerSchema,
  MealRecord,
  MealRecordSchema,
} from '../core/schemas';
import { MessModule } from '../mess/mess.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MessModule,
    MongooseModule.forFeature([
      { name: Bill.name, schema: BillSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: MealRecord.name, schema: MealRecordSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
