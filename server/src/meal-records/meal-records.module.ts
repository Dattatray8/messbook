import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Customer,
  CustomerSchema,
  MealRecord,
  MealRecordSchema,
  MenuItem,
  MenuItemSchema,
  Mess,
  MessSchema,
} from '../core/schemas';
import { MessModule } from '../mess/mess.module';
import { MealRecordsController } from './meal-records.controller';
import { MealRecordsService } from './meal-records.service';

@Module({
  imports: [
    MessModule,
    MongooseModule.forFeature([
      { name: MealRecord.name, schema: MealRecordSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: Mess.name, schema: MessSchema },
    ]),
  ],
  controllers: [MealRecordsController],
  providers: [MealRecordsService],
  exports: [MealRecordsService],
})
export class MealRecordsModule {}
