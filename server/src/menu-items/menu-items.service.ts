import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MenuItem, MenuItemDocument } from '../core/schemas';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
  ) {}

  async create(messId: string, dto: CreateMenuItemDto) {
    return this.menuItemModel.create({ ...dto, messId });
  }

  async findByMess(messId: string, active?: string) {
    const query: Record<string, unknown> = { messId };
    if (active === 'true' || active === 'false') {
      query.isActive = active === 'true';
    }
    return this.menuItemModel.find(query).sort({ category: 1, name: 1 }).lean();
  }

  async update(id: string, messId: string, patch: UpdateMenuItemDto) {
    const item = await this.menuItemModel
      .findOneAndUpdate({ _id: id, messId }, { $set: patch }, { new: true })
      .lean();
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return item;
  }
}
