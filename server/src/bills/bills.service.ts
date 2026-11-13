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
  toISTDateString,
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
import { periodKeyFor } from './billing-schedule';
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

    const now = new Date();
    const ref = dto.referenceDate ? parseDay(dto.referenceDate) : now;
    let start: Date;
    let end: Date;
    let partialPeriod = false;

    if (customer.billingType === 'WEEKLY') {
      ({ start, end } = weekPeriod(ref));
      const current = weekPeriod(now);
      if (current.start.getTime() === start.getTime()) {
        end = endOfDayIST(now);
        partialPeriod = true;
      }
    } else if (customer.billingType === 'MONTHLY') {
      ({ start, end } = monthPeriod(ref));
      const current = monthPeriod(now);
      if (current.start.getTime() === start.getTime()) {
        end = endOfDayIST(now);
        partialPeriod = true;
      }
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

    const fullPeriodKey =
      customer.billingType === 'PAY_PER_MEAL'
        ? null
        : periodKeyFor(customer.billingType, start);
    // Manual generation during the current week/month is an interim bill. Give it a
    // distinct key so the end-of-period automatic bill can charge remaining meals later.
    const periodKey = partialPeriod && fullPeriodKey
      ? `${fullPeriodKey}:PARTIAL:${toISTDateString(now)}:${Date.now()}`
      : fullPeriodKey;

    // Plans can only be billed once per period. (The unique periodKey index is the real guard;
    // this check gives a friendly answer and also covers legacy bills that have no periodKey.)
    let alreadyBilled = false;
    if (periodKey) {
      alreadyBilled = await this.periodAlreadyBilled(
        messId,
        dto.customerId,
        customer.billingType,
        start,
        end,
        periodKey,
      );
      if (alreadyBilled && !dto.preview) {
        throw new ConflictException(
          'A bill has already been generated for this period',
        );
      }
    }

    const calc = await this.calculate(messId, customer, start, end);

    const result = {
      customerId: dto.customerId,
      customerName: customer.name,
      billingType: customer.billingType,
      periodStart: start,
      periodEnd: end,
      items: calc.items,
      totalAmount: calc.totalAmount,
      mealCount: calc.records.length,
      coveredByPlanCount: calc.coveredCount,
      alreadyBilled,
    };

    if (dto.preview) return { preview: true, ...result };

    if (calc.items.length === 0 || calc.totalAmount <= 0) {
      throw new BadRequestException('Nothing to bill for this period');
    }

    const saved = await this.persist(messId, customer, start, end, calc, {
      periodKey,
      source: 'MANUAL',
    });
    if (!saved) {
      throw new ConflictException(
        'A bill has already been generated for this period',
      );
    }
    return saved;
  }

  /**
   * Shared entry point for bulk / scheduled generation: bills ONE explicit period for ONE customer
   * through exactly the same calculation and persistence path as the manual endpoint.
   * Never throws for the expected "already billed" / "nothing to bill" cases.
   */
  async generateForPeriod(
    messId: string,
    customerId: string,
    period: { start: Date; end: Date; key: string },
    ctx: { source: 'MANUAL' | 'AUTOMATIC'; runId?: string },
  ): Promise<
    | { outcome: 'CREATED'; bill: Record<string, any> }
    | { outcome: 'ALREADY_BILLED' }
    | { outcome: 'NOTHING_TO_BILL' }
  > {
    const customer = await this.customerModel
      .findOne({ _id: customerId, messId })
      .lean();
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.billingType === 'PAY_PER_MEAL') {
      throw new BadRequestException(
        'Pay-per-meal customers have no billing cycle',
      );
    }

    if (
      await this.periodAlreadyBilled(
        messId,
        customerId,
        customer.billingType,
        period.start,
        period.end,
        period.key,
      )
    ) {
      return { outcome: 'ALREADY_BILLED' };
    }

    const calc = await this.calculate(
      messId,
      customer,
      period.start,
      period.end,
    );
    if (calc.items.length === 0 || calc.totalAmount <= 0) {
      return { outcome: 'NOTHING_TO_BILL' };
    }

    const bill = await this.persist(
      messId,
      customer,
      period.start,
      period.end,
      calc,
      { periodKey: period.key, source: ctx.source, runId: ctx.runId },
    );
    // null => lost a race to another request; the period is billed, which is the goal.
    return bill ? { outcome: 'CREATED', bill } : { outcome: 'ALREADY_BILLED' };
  }

  async periodAlreadyBilled(
    messId: string,
    customerId: string,
    billingType: 'PAY_PER_MEAL' | 'WEEKLY' | 'MONTHLY',
    start: Date,
    end: Date,
    periodKey: string,
  ): Promise<boolean> {
    const isPartial = periodKey.includes(':PARTIAL:');
    const fullKey = isPartial ? periodKey.split(':PARTIAL:')[0] : periodKey;
    const fullEnd = billingType === 'WEEKLY'
      ? weekPeriod(start).end
      : monthPeriod(start).end;
    return !!(await this.billModel.exists({
      messId,
      customerId,
      $or: [
        { periodKey: fullKey },
        // Legacy full-period bills may not have a periodKey. Partial manual bills must
        // not block the final scheduled bill, nor another manual bill later the same day.
        { billingType, periodStart: start, periodEnd: fullEnd },
      ],
    }));
  }

  /** Single calculation path: unbilled meals in the period -> items/total via computeBill. */
  private async calculate(
    messId: string,
    customer: {
      _id: unknown;
      billingType: 'PAY_PER_MEAL' | 'WEEKLY' | 'MONTHLY';
    },
    start: Date,
    end: Date,
  ) {
    // Only meals not yet attached to any bill are eligible, so nothing is ever charged twice.
    const records = await this.mealModel
      .find({
        messId,
        customerId: String(customer._id),
        billId: null,
        mealDate: { $gte: start, $lte: end },
      })
      .sort({ mealDate: 1 })
      .lean();
    const { items, totalAmount, coveredCount } = computeBill(
      customer.billingType,
      0,
      records,
    );
    return { records, items, totalAmount, coveredCount };
  }

  /**
   * Inserts the bill. The unique (messId, customerId, periodKey) index makes this atomic: a
   * concurrent duplicate gets E11000 and we return null instead of creating a second bill.
   */
  private async persist(
    messId: string,
    customer: {
      _id: unknown;
      name: string;
      billingType: 'PAY_PER_MEAL' | 'WEEKLY' | 'MONTHLY';
    },
    start: Date,
    end: Date,
    calc: Awaited<ReturnType<BillsService['calculate']>>,
    meta: {
      periodKey: string | null;
      source: 'MANUAL' | 'AUTOMATIC';
      runId?: string;
    },
  ): Promise<Record<string, any> | null> {
    let bill: BillDocument;
    try {
      bill = await this.billModel.create({
        messId,
        customerId: String(customer._id),
        customerName: customer.name,
        billingType: customer.billingType,
        items: calc.items,
        totalAmount: calc.totalAmount,
        periodStart: start,
        periodEnd: end,
        status: 'Generated',
        periodKey: meta.periodKey,
        source: meta.source,
        automationRunId: meta.runId ?? null,
      });
    } catch (e) {
      if ((e as { code?: number })?.code === 11000) return null;
      throw e;
    }

    // Lock the meals to this bill (the billId: null filter guards against concurrent generation).
    await this.mealModel.updateMany(
      { _id: { $in: calc.records.map((r) => r._id) }, billId: null },
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
