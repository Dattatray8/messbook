import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  endOfDayIST,
  monthPeriod,
  parseDay,
  startOfDayIST,
  weekPeriod,
} from '../common/dates';
import {
  Bill,
  BillDocument,
  Customer,
  CustomerDocument,
  MealRecord,
  MealRecordDocument,
} from '../core/schemas';
import { computeBill } from './billing.util';
import { GenerateBillDto } from './dto/generate-bill.dto';

@Injectable()
export class BillsService {
  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<BillDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(MealRecord.name)
    private readonly mealModel: Model<MealRecordDocument>,
  ) {}

  async generate(messId: string, dto: GenerateBillDto) {
    const customer = await this.customerModel
      .findOne({ _id: dto.customerId, messId })
      .lean();
    if (!customer) throw new NotFoundException('Customer not found');

    const ref = dto.referenceDate ? parseDay(dto.referenceDate) : new Date();
    let start: Date;
    let end: Date;

    if (customer.billingType === 'WEEKLY') {
      ({ start, end } = weekPeriod(ref));
    } else if (customer.billingType === 'MONTHLY') {
      ({ start, end } = monthPeriod(ref));
    } else {
      end = dto.endDate
        ? endOfDayIST(parseDay(dto.endDate))
        : endOfDayIST(new Date());
      if (dto.startDate) {
        start = startOfDayIST(parseDay(dto.startDate));
      } else {
        const earliest = await this.mealModel
          .findOne({
            messId,
            customerId: dto.customerId,
            billId: null,
            mealDate: { $lte: end },
          })
          .sort({ mealDate: 1 })
          .lean();
        start = startOfDayIST(earliest?.mealDate ?? new Date());
      }
    }
    if (start > end)
      throw new BadRequestException('Start date must be before end date');

    // Plans can only be billed once per period.
    let alreadyBilled = false;
    if (customer.billingType !== 'PAY_PER_MEAL') {
      alreadyBilled = !!(await this.billModel.exists({
        messId,
        customerId: dto.customerId,
        billingType: customer.billingType,
        periodStart: start,
      }));
      if (alreadyBilled && !dto.preview) {
        throw new ConflictException(
          'A bill has already been generated for this period',
        );
      }
    }

    // Only meals not yet attached to any bill are eligible, so nothing is ever charged twice.
    const records = await this.mealModel
      .find({
        messId,
        customerId: dto.customerId,
        billId: null,
        mealDate: { $gte: start, $lte: end },
      })
      .sort({ mealDate: 1 })
      .lean();

    const { items, totalAmount, coveredCount } = computeBill(
      customer.billingType,
      customer.planAmount ?? 0,
      records,
    );

    const result = {
      customerId: dto.customerId,
      customerName: customer.name,
      billingType: customer.billingType,
      periodStart: start,
      periodEnd: end,
      items,
      totalAmount,
      mealCount: records.length,
      coveredByPlanCount: coveredCount,
      alreadyBilled,
    };

    if (dto.preview) return { preview: true, ...result };

    if (items.length === 0 || totalAmount <= 0) {
      throw new BadRequestException('Nothing to bill for this period');
    }

    const bill = await this.billModel.create({
      messId,
      customerId: dto.customerId,
      customerName: customer.name,
      billingType: customer.billingType,
      items,
      totalAmount,
      periodStart: start,
      periodEnd: end,
      status: 'Generated',
    });

    // Lock the meals to this bill (the billId: null filter guards against concurrent generation).
    await this.mealModel.updateMany(
      { _id: { $in: records.map((r) => r._id) }, billId: null },
      { $set: { billId: String(bill._id) } },
    );

    return bill.toObject();
  }

  async list(messId: string, f: { status?: string; customerId?: string }) {
    const query: Record<string, unknown> = { messId };
    if (f.status === 'Generated' || f.status === 'PAID')
      query.status = f.status;
    if (f.customerId) query.customerId = f.customerId;
    return this.billModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async details(id: string, messId: string) {
    const bill = await this.billModel.findOne({ _id: id, messId }).lean();
    if (!bill) throw new NotFoundException('Bill not found');
    const meals = await this.mealModel
      .find({ messId, billId: id })
      .sort({ mealDate: 1 })
      .lean();
    const customer = await this.customerModel
      .findOne({ _id: bill.customerId, messId })
      .select('name phone')
      .lean();
    return { bill, meals, customer };
  }

  async markPaid(id: string, messId: string) {
    const bill = await this.billModel
      .findOneAndUpdate(
        { _id: id, messId },
        { $set: { status: 'PAID', paidAt: new Date() } },
        { new: true },
      )
      .lean();
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  async markUnpaid(id: string, messId: string) {
    const bill = await this.billModel
      .findOneAndUpdate(
        { _id: id, messId },
        { $set: { status: 'Generated', paidAt: null } },
        { new: true },
      )
      .lean();
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }
}
