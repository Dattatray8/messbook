import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMessDto } from './dto/create-mess.dto';
import { UpdateMessDto } from './dto/update-mess.dto';
import { MessService } from './mess.service';

@Controller('mess')
export class MessController {
  constructor(private readonly messService: MessService) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMessDto,
  ) {
    return this.messService.create(user.id, dto);
  }

  @Patch('me')
  async updateMyMess(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateMessDto,
  ) {
    return this.messService.update(user.id, dto);
  }

  @Get('me')
  async getMyMess(@CurrentUser() user: { id: string }) {
    return this.messService.findByOwnerId(user.id);
  }
}
