import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Bill,
  BillDocument,
  Customer,
  CustomerDocument,
  MealRecord,
  MealRecordDocument,
} from '../core/schemas';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(MealRecord.name)
    private readonly mealModel: Model<MealRecordDocument>,
    @InjectModel(Bill.name) private readonly billModel: Model<BillDocument>,
  ) {}

  async create(messId: string, dto: CreateCustomerDto) {
    return this.customerModel.create({ ...dto, messId });
  }

  async findByMess(
    messId: string,
    filters: { search?: string; active?: string } = {},
  ) {
    const query: Record<string, unknown> = { messId };
    if (filters.active === 'true' || filters.active === 'false') {
      query.isActive = filters.active === 'true';
    }
    if (filters.search?.trim()) {
      const rx = new RegExp(escapeRegex(filters.search.trim()), 'i');
      query.$or = [{ name: rx }, { phone: rx }];
    }
    const customers = await this.customerModel
      .find(query)
      .sort({ name: 1 })
      .lean();

    // Attach outstanding balance (sum of unpaid bills) for list display.
    const pending = await this.billModel.aggregate<{
      _id: string;
      total: number;
    }>([
      { $match: { messId, status: 'Generated' } },
      { $group: { _id: '$customerId', total: { $sum: '$totalAmount' } } },
    ]);
    const pendingMap = new Map(pending.map((p) => [p._id, p.total]));
    return customers.map((c) => ({
      ...c,
      outstanding: pendingMap.get(String(c._id)) ?? 0,
    }));
  }

  async findOne(id: string, messId: string) {
    const customer = await this.customerModel
      .findOne({ _id: id, messId })
      .lean();
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async getDetails(id: string, messId: string) {
    const customer = await this.findOne(id, messId);
    const [meals, bills, unbilled] = await Promise.all([
      this.mealModel
        .find({ messId, customerId: id })
        .sort({ mealDate: -1, createdAt: -1 })
        .limit(100)
        .lean(),
      this.billModel
        .find({ messId, customerId: id })
        .sort({ createdAt: -1 })
        .lean(),
      this.mealModel.aggregate<{ total: number }>([
        { $match: { messId, customerId: id, billId: null } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);
    const outstanding = bills
      .filter((b) => b.status === 'Generated')
      .reduce((s, b) => s + b.totalAmount, 0);
    const totalPaid = bills
      .filter((b) => b.status === 'PAID')
      .reduce((s, b) => s + b.totalAmount, 0);
    return {
      customer,
      meals,
      bills,
      summary: {
        outstanding,
        totalPaid,
        unbilledAmount: unbilled[0]?.total ?? 0,
      },
    };
  }

  async update(id: string, messId: string, patch: UpdateCustomerDto) {
    const customer = await this.customerModel
      .findOneAndUpdate({ _id: id, messId }, { $set: patch }, { new: true })
      .lean();
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }
}
