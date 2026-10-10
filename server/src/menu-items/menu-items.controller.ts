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
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuItemsService } from './menu-items.service';

@Controller('menu-items')
export class MenuItemsController {
  constructor(
    private readonly menuItemsService: MenuItemsService,
    private readonly messService: MessService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMenuItemDto,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.menuItemsService.create(messId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('active') active?: string,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.menuItemsService.findByMess(messId, active);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    const messId = await this.messService.getMessIdForOwner(user.id);
    return this.menuItemsService.update(id, messId, dto);
  }
}
