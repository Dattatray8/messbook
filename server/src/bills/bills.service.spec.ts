import { BadRequestException, ConflictException } from '@nestjs/common';
import { BillsService } from './bills.service';

const chain = (v: any) => {
  const c: any = {
    sort: () => c,
    limit: () => c,
    select: () => c,
    lean: () => Promise.resolve(v),
    then: (r: any, j: any) => Promise.resolve(v).then(r, j),
  };
  return c;
};
const period = {
  start: new Date('2026-09-28T00:00:00+05:30'),
  end: new Date('2026-10-04T23:59:59.999+05:30'),
  key: 'WEEKLY:2026-09-28',
};
const customer = {
  _id: 'c1',
  messId: 'm1',
  name: 'Asha',
  billingType: 'WEEKLY',
};

function build(
  over: { exists?: any; createErr?: any; customer?: any; meals?: any[] } = {},
) {
  const billModel: any = {
    exists: jest.fn().mockResolvedValue(over.exists ?? null),
    create: jest.fn(async (d: any) => {
      if (over.createErr) throw over.createErr;
      return { _id: 'b1', toObject: () => ({ _id: 'b1', ...d }) };
    }),
  };
  const customerModel: any = {
    findOne: jest.fn(() =>
      chain(over.customer === undefined ? customer : over.customer),
    ),
  };
  const mealModel: any = {
    find: jest.fn(() => chain(over.meals ?? [])),
    updateMany: jest.fn().mockResolvedValue({}),
  };
  return {
    svc: new BillsService(billModel, customerModel, mealModel),
    billModel,
    mealModel,
  };
}

describe('BillsService.generateForPeriod (shared by manual-bulk and scheduled paths)', () => {
  it('creates a bill tagged with periodKey/source/run and locks the covered meals', async () => {
    const { svc, billModel, mealModel } = build({
      meals: [
        {
          _id: 'x1',
          mealName: 'Thali',
          category: 'LUNCH',
          mealQuantity: 1,
          mealUnitPrice: 80,
          totalAmount: 80,
        },
      ],
    });
    const r = await svc.generateForPeriod('m1', 'c1', period, {
      source: 'AUTOMATIC',
      runId: 'run1',
    });
    expect(r.outcome).toBe('CREATED');
    expect(billModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        periodKey: 'WEEKLY:2026-09-28',
        source: 'AUTOMATIC',
        automationRunId: 'run1',
        totalAmount: 80,
      }),
    );
    expect(mealModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['x1'] }, billId: null },
      { $set: { billId: 'b1' } },
    );
  });

  it('skips a period that already has a bill without calculating or creating', async () => {
    const { svc, billModel, mealModel } = build({ exists: { _id: 'old' } });
    expect(
      (await svc.generateForPeriod('m1', 'c1', period, { source: 'MANUAL' }))
        .outcome,
    ).toBe('ALREADY_BILLED');
    expect(billModel.create).not.toHaveBeenCalled();
    expect(mealModel.find).not.toHaveBeenCalled();
  });

  it('the already-billed check also matches legacy bills that have no periodKey', async () => {
    const { svc, billModel } = build({ exists: { _id: 'legacy' } });
    await svc.generateForPeriod('m1', 'c1', period, { source: 'MANUAL' });
    expect(billModel.exists).toHaveBeenCalledWith({
      messId: 'm1',
      customerId: 'c1',
      $or: [
        { periodKey: 'WEEKLY:2026-09-28' },
        { billingType: 'WEEKLY', periodStart: period.start, periodEnd: period.end },
      ],
    });
  });

  it('a concurrent duplicate (E11000 from the unique index) is reported as ALREADY_BILLED and locks no meals', async () => {
    const { svc, mealModel } = build({
      createErr: Object.assign(new Error('dup'), { code: 11000 }),
    });
    expect(
      (await svc.generateForPeriod('m1', 'c1', period, { source: 'AUTOMATIC' }))
        .outcome,
    ).toBe('ALREADY_BILLED');
    expect(mealModel.updateMany).not.toHaveBeenCalled();
  });

  it('non-duplicate database errors are NOT swallowed', async () => {
    const { svc } = build({ createErr: new Error('connection lost') });
    await expect(
      svc.generateForPeriod('m1', 'c1', period, { source: 'AUTOMATIC' }),
    ).rejects.toThrow('connection lost');
  });

  it('plan with zero amount and no extras has nothing to bill', async () => {
    const { svc, billModel } = build({
      customer: { ...customer },
    });
    expect(
      (await svc.generateForPeriod('m1', 'c1', period, { source: 'AUTOMATIC' }))
        .outcome,
    ).toBe('NOTHING_TO_BILL');
    expect(billModel.create).not.toHaveBeenCalled();
  });

  it('refuses a customer from another mess (ownership scoping in the query)', async () => {
    const { svc } = build({ customer: null });
    await expect(
      svc.generateForPeriod('other-mess', 'c1', period, { source: 'MANUAL' }),
    ).rejects.toThrow('Customer not found');
  });

  it('refuses pay-per-meal customers (no cycle)', async () => {
    const { svc } = build({
      customer: { ...customer, billingType: 'PAY_PER_MEAL' },
    });
    await expect(
      svc.generateForPeriod('m1', 'c1', period, { source: 'MANUAL' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('BillsService.generate (existing manual endpoint) - repeat safety', () => {
  it('a repeated request for an already-billed period is a Conflict, not a second bill', async () => {
    const { svc, billModel } = build({ exists: { _id: 'b-existing' } });
    await expect(
      svc.generate('m1', { customerId: 'c1', referenceDate: '2026-10-01' }),
    ).rejects.toThrow(ConflictException);
    expect(billModel.create).not.toHaveBeenCalled();
  });

  it('losing the race at insert time is also a Conflict (double-tap / network retry)', async () => {
    const { svc } = build({
      createErr: Object.assign(new Error('dup'), { code: 11000 }),
    });
    await expect(
      svc.generate('m1', { customerId: 'c1', referenceDate: '2026-10-01' }),
    ).rejects.toThrow(ConflictException);
  });

  it('preview never writes', async () => {
    const { svc, billModel } = build({ exists: { _id: 'b' } });
    const r: any = await svc.generate('m1', {
      customerId: 'c1',
      referenceDate: '2026-10-01',
      preview: true,
    });
    expect(r.alreadyBilled).toBe(true);
    expect(billModel.create).not.toHaveBeenCalled();
  });
});
