import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Mess, MessDocument } from '../core/schemas';
import { CreateMessDto } from './dto/create-mess.dto';
import { UpdateMessDto } from './dto/update-mess.dto';

@Injectable()
export class MessService {
  constructor(
    @InjectModel(Mess.name) private readonly messModel: Model<MessDocument>,
  ) {}

  async create(ownerId: string, dto: CreateMessDto) {
    const existing = await this.messModel.findOne({ ownerId }).lean();
    if (existing) {
      throw new ConflictException(
        'A mess is already associated with this account',
      );
    }

    return this.messModel.create({
      ...dto,
      ownerId,
      mealTypes: dto.mealTypes ?? ['BREAKFAST', 'LUNCH', 'DINNER'],
    });
  }

  async findByOwnerId(ownerId: string) {
    const mess = await this.messModel.findOne({ ownerId }).lean();
    if (!mess) {
      throw new NotFoundException('Mess not found for this account');
    }
    return mess;
  }

  async update(ownerId: string, dto: UpdateMessDto) {
    const mess = await this.messModel
      .findOneAndUpdate({ ownerId }, { $set: dto }, { new: true })
      .lean();
    if (!mess) {
      throw new NotFoundException('Mess not found for this account');
    }
    return mess;
  }

  async getMessIdForOwner(ownerId: string): Promise<string> {
    const mess = await this.messModel.findOne({ ownerId }).select('_id').lean();
    if (!mess) {
      throw new NotFoundException('Mess not found for this account');
    }
    return String(mess._id);
  }
}
