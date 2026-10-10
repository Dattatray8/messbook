import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { endOfDayIST, startOfDayIST } from '../common/dates';
import {
  Bill,
  BillDocument,
  Customer,
  CustomerDocument,
  MealRecord,
  MealRecordDocument,
} from '../core/schemas';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<BillDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(MealRecord.name)
    private readonly mealModel: Model<MealRecordDocument>,
  ) {}

  async overview(messId: string) {
    const now = new Date();
    const dayStart = startOfDayIST(now);
    const dayEnd = endOfDayIST(now);

    const [
      totalCustomers,
      activeCustomers,
      todayByType,
      pending,
      unbilled,
      topPending,
      collected,
    ] = await Promise.all([
      this.customerModel.countDocuments({ messId }),
      this.customerModel.countDocuments({ messId, isActive: true }),
      this.mealModel.aggregate<{
        _id: string;
        quantity: number;
        amount: number;
      }>([
        { $match: { messId, mealDate: { $gte: dayStart, $lte: dayEnd } } },
        {
          $group: {
            _id: '$mealType',
            quantity: { $sum: '$mealQuantity' },
            amount: { $sum: '$totalAmount' },
          },
        },
      ]),
      this.billModel.aggregate<{ _id: null; total: number; count: number }>([
        { $match: { messId, status: 'Generated' } },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      this.mealModel.aggregate<{ _id: null; total: number }>([
        { $match: { messId, billId: null } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      this.billModel.aggregate<{ _id: string; name: string; total: number }>([
        { $match: { messId, status: 'Generated' } },
        {
          $group: {
            _id: '$customerId',
            name: { $first: '$customerName' },
            total: { $sum: '$totalAmount' },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
      this.billModel.aggregate<{ _id: null; total: number }>([
        { $match: { messId, status: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const mealsByType = { BREAKFAST: 0, LUNCH: 0, DINNER: 0 } as Record<
      string,
      number
    >;
    for (const row of todayByType) mealsByType[row._id] = row.quantity;

    return {
      totalCustomers,
      activeCustomers,
      todayMeals: todayByType.reduce((s, r) => s + r.quantity, 0),
      todayRevenue: todayByType.reduce((s, r) => s + r.amount, 0),
      mealsByType,
      pendingAmount: pending[0]?.total ?? 0,
      pendingBillsCount: pending[0]?.count ?? 0,
      unbilledAmount: unbilled[0]?.total ?? 0,
      collectedAmount: collected[0]?.total ?? 0,
      topPending: topPending.map((p) => ({
        customerId: p._id,
        name: p.name,
        amount: p.total,
      })),
    };
  }
}
