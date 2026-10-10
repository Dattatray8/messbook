import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessService } from '../mess/mess.service';
import { GenerateBillDto } from './dto/generate-bill.dto';
import { BillsService } from './bills.service';

@Controller('bills')
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly messService: MessService,
  ) {}

  /** Generates (or previews, with preview=true) a bill using stored meal records and billing rules. */
  @Post('generate')
  async generate(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateBillDto,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.billsService.generate(messId, dto);
  }

  /** GET /bills?status=Generated|PAID&customerId= */
  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.billsService.list(messId, { status, customerId });
  }

  @Get(':id')
  async details(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.billsService.details(id, messId);
  }

  @Patch(':id/pay')
  async markPaid(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.billsService.markPaid(id, messId);
  }

  @Patch(':id/unpay')
  async markUnpaid(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.billsService.markUnpaid(id, messId);
  }
}
