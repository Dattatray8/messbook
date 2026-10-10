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
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [
    MessModule,
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: MealRecord.name, schema: MealRecordSchema },
      { name: Bill.name, schema: BillSchema },
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
