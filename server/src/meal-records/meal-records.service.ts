import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { endOfDayIST, parseDay, startOfDayIST, toISTDateString } from '../common/dates';
import { BillsService } from '../bills/bills.service';
import {
  Customer,
  CustomerDocument,
  MealRecord,
  MealRecordDocument,
  MenuItem,
  MenuItemDocument,
  Mess,
  MessDocument,
} from '../core/schemas';
import { CreateMealRecordDto } from './dto/create-meal-record.dto';

@Injectable()
export class MealRecordsService {
  private readonly logger = new Logger(MealRecordsService.name);
  constructor(
    @InjectModel(MealRecord.name)
    private readonly mealRecordModel: Model<MealRecordDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
    @InjectModel(Mess.name) private readonly messModel: Model<MessDocument>,
    private readonly billsService: BillsService,
  ) {}

  async create(messId: string, dto: CreateMealRecordDto) {
    const customer = await this.customerModel
      .findOne({ _id: dto.customerId, messId })
      .lean();
    if (!customer) throw new NotFoundException('Customer not found');
    if (!customer.isActive)
      throw new BadRequestException('Customer is inactive');

    const mess = await this.messModel
      .findById(messId)
      .select('mealTypes')
      .lean();
    if (mess && !mess.mealTypes.includes(dto.mealType)) {
      throw new BadRequestException(
        `${dto.mealType} is not enabled for this mess`,
      );
    }

    const ids = [...new Set(dto.items.map((i) => i.menuItemId))];
    const menuItems = await this.menuItemModel
      .find({ _id: { $in: ids }, messId })
      .lean();
    const byId = new Map(menuItems.map((m) => [String(m._id), m]));

    for (const line of dto.items) {
      const item = byId.get(line.menuItemId);
      if (!item) throw new NotFoundException('Menu item not found');
      if (!item.isActive)
        throw new BadRequestException(`"${item.name}" is not available`);
    }

    const mealDate = dto.mealDate ? parseDay(dto.mealDate) : new Date();
    const docs = dto.items.map((line) => {
      const item = byId.get(line.menuItemId)!;
      return {
        messId,
        customerId: dto.customerId,
        mealType: dto.mealType,
        mealName: item.name,
        menuItemId: String(item._id),
        category: item.category,
        mealQuantity: line.quantity,
        mealUnitPrice: item.price,
        totalAmount: Math.round(line.quantity * item.price * 100) / 100,
        mealDate,
        billId: null,
      };
    });
    const created = await this.mealRecordModel.insertMany(docs);

    // Pay-per-meal customers are billed immediately after recording meals. The shared bill
    // service only includes still-unbilled records for that IST date, and stores price snapshots.
    // If bill persistence fails, the meal records remain saved and can be billed manually later.
    if (
      customer.billingType === 'PAY_PER_MEAL' &&
      created.length > 0 &&
      docs.some((record) => record.totalAmount > 0)
    ) {
      const day = toISTDateString(mealDate);
      try {
        await this.billsService.generate(messId, {
          customerId: String(customer._id),
          startDate: day,
          endDate: day,
        });
      } catch (error) {
        // The meal records are already safely saved. Do not tell the user meal recording failed;
        // leave any unbilled records available for the existing manual billing flow and log the issue.
        this.logger.error(
          `Automatic pay-per-meal billing failed for customer ${String(customer._id)}: ${(error as Error).message}`,
        );
      }
    }

    return created;
  }

  async list(
    messId: string,
    f: {
      customerId?: string;
      date?: string;
      from?: string;
      to?: string;
      limit?: number;
    },
  ) {
    const query: Record<string, unknown> = { messId };
    if (f.customerId) query.customerId = f.customerId;
    if (f.date) {
      const d = parseDay(f.date);
      query.mealDate = { $gte: startOfDayIST(d), $lte: endOfDayIST(d) };
    } else if (f.from || f.to) {
      const range: Record<string, Date> = {};
      if (f.from) range.$gte = startOfDayIST(parseDay(f.from));
      if (f.to) range.$lte = endOfDayIST(parseDay(f.to));
      query.mealDate = range;
    }

    const records = await this.mealRecordModel
      .find(query)
      .sort({ mealDate: -1, createdAt: -1 })
      .limit(Math.min(Math.max(f.limit ?? 200, 1), 500))
      .lean();

    const customerIds = [...new Set(records.map((r) => r.customerId))];
    const customers = await this.customerModel
      .find({ _id: { $in: customerIds }, messId })
      .select('name')
      .lean();
    const names = new Map(customers.map((c) => [String(c._id), c.name]));
    return records.map((r) => ({
      ...r,
      customerName: names.get(r.customerId) ?? 'Unknown',
    }));
  }

  async remove(id: string, messId: string) {
    const record = await this.mealRecordModel
      .findOne({ _id: id, messId })
      .lean();
    if (!record) throw new NotFoundException('Meal record not found');
    if (record.billId) {
      throw new ConflictException(
        'This meal is already included in a bill and cannot be deleted',
      );
    }
    await this.mealRecordModel.deleteOne({ _id: id, messId });
  }
}
