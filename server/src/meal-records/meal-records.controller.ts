import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessService } from '../mess/mess.service';
import { CreateMealRecordDto } from './dto/create-meal-record.dto';
import { MealRecordsService } from './meal-records.service';

@Controller('meal-records')
export class MealRecordsController {
  constructor(
    private readonly mealRecordsService: MealRecordsService,
    private readonly messService: MessService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMealRecordDto,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.mealRecordsService.create(messId, dto);
  }

  /** GET /meal-records?customerId=&date=YYYY-MM-DD&from=&to=&limit= */
  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('customerId') customerId?: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.mealRecordsService.list(messId, {
      customerId,
      date,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    await this.mealRecordsService.remove(id, messId);
    return { deleted: true };
  }
}
