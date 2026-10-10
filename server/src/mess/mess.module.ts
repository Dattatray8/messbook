import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Mess, MessSchema } from '../core/schemas';
import { MessController } from './mess.controller';
import { MessService } from './mess.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Mess.name, schema: MessSchema }]),
  ],
  controllers: [MessController],
  providers: [MessService],
  exports: [MessService],
})
export class MessModule {}
