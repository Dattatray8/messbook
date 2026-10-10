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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly messService: MessService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCustomerDto,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.customersService.create(messId, dto);
  }

  /** GET /customers?search=ram&active=true */
  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.customersService.findByMess(messId, { search, active });
  }

  @Get(':id')
  async details(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.customersService.getDetails(id, messId);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.customersService.update(id, messId, dto);
  }
}
