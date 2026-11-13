import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

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
const dupErr = () => Object.assign(new Error('E11000'), { code: 11000 });

function make(
  o: {
    settings?: any;
    createErr?: any;
    existing?: any;
    tokens?: any[];
    pushThrows?: boolean;
    markReadResult?: any;
  } = {},
) {
  const doc = {
    _id: 'n1',
    ownerId: 'o1',
    category: 'billing',
    type: 'AUTO_BILLS_GENERATED',
    title: 't',
    message: 'm',
    relatedType: 'bills',
    relatedId: null,
    toObject() {
      return { ...this };
    },
  };
  const model: any = {
    create: jest.fn(async () => {
      if (o.createErr) throw o.createErr;
      return doc;
    }),
    findOne: jest.fn(() => chain(o.existing ?? null)),
    findOneAndUpdate: jest.fn(() =>
      chain(
        o.markReadResult === undefined
          ? { _id: 'n1', isRead: true }
          : o.markReadResult,
      ),
    ),
    updateOne: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
    countDocuments: jest.fn().mockResolvedValue(2),
    find: jest.fn(() => chain([])),
  };
  const tokenModel: any = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    countDocuments: jest.fn().mockResolvedValue(1),
  };
  const settingsModel: any = {
    findOne: jest.fn(() =>
      chain(
        o.settings === undefined
          ? { pushEnabled: true, billingNotifications: true }
          : o.settings,
      ),
    ),
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
  };
  const push: any = {
    activeTokens: jest
      .fn()
      .mockResolvedValue(
        o.tokens ?? [{ _id: 't1', token: 'ExponentPushToken[abc]' }],
      ),
    send: jest.fn(async () => {
      if (o.pushThrows) throw new Error('expo exploded');
      return { status: 'SENT', tickets: [{ ticketId: 'tk', tokenId: 't1' }] };
    }),
  };
  const mess: any = { getMessIdForOwner: jest.fn().mockResolvedValue('m1') };
  return {
    svc: new NotificationsService(model, tokenModel, settingsModel, push, mess),
    model,
    tokenModel,
    settingsModel,
    push,
  };
}

const input = {
  ownerId: 'o1',
  messId: 'm1',
  type: 'AUTO_BILLS_GENERATED' as const,
  category: 'billing' as const,
  title: 'Bills generated',
  message: '2 bills',
  eventKey: 'auto-bills:m1:2026-10-12',
  push: true,
};

describe('create(): persistence, idempotency, push isolation', () => {
  it('persists first, then attempts push and records the outcome', async () => {
    const { svc, model, push } = make();
    const r = await svc.create(input);
    expect(r.created).toBe(true);
    expect(model.create).toHaveBeenCalled();
    expect(push.send).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        data: expect.not.objectContaining({ customerName: expect.anything() }),
      }),
    );
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'n1' },
      {
        $set: expect.objectContaining({
          'push.status': 'SENT',
          'push.receiptsChecked': false,
        }),
      },
    );
  });

  it('a duplicate event key (retried scheduled event) returns the existing notification and sends NO second push', async () => {
    const { svc, push } = make({
      createErr: dupErr(),
      existing: { _id: 'old' },
    });
    const r = await svc.create(input);
    expect(r).toEqual({ notification: { _id: 'old' }, created: false });
    expect(push.send).not.toHaveBeenCalled();
  });

  it('non-duplicate persistence errors propagate (caller treats as non-fatal to billing)', async () => {
    const { svc } = make({ createErr: new Error('db down') });
    await expect(svc.create(input)).rejects.toThrow('db down');
  });

  it('push failure keeps the in-app notification and is recorded as FAILED', async () => {
    const { svc, model } = make({ pushThrows: true });
    const r = await svc.create(input);
    expect(r.created).toBe(true); // notification survives
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'n1' },
      { $set: expect.objectContaining({ 'push.status': 'FAILED' }) },
    );
  });

  it('does not push when the owner has push turned off (app-level preference)', async () => {
    const { svc, push, model } = make({
      settings: { pushEnabled: false, billingNotifications: true },
    });
    await svc.create(input);
    expect(push.send).not.toHaveBeenCalled();
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'n1' },
      {
        $set: expect.objectContaining({
          'push.status': 'SKIPPED',
          'push.reason': 'disabled_by_owner',
        }),
      },
    );
  });

  it('does not push when the billing category is disabled', async () => {
    const { svc, push } = make({
      settings: { pushEnabled: true, billingNotifications: false },
    });
    await svc.create(input);
    expect(push.send).not.toHaveBeenCalled();
  });

  it('does not push when the owner has no settings at all', async () => {
    const { svc, push } = make({ settings: null });
    await svc.create(input);
    expect(push.send).not.toHaveBeenCalled();
  });

  it('records SKIPPED (not SENT) when there are no registered devices / permission was not granted', async () => {
    const { svc, push } = make({ tokens: [] });
    push.send.mockResolvedValue({
      status: 'SKIPPED',
      reason: 'no_active_tokens',
      tickets: [],
    });
    await svc.create(input);
    expect(push.send).toHaveBeenCalledWith([], expect.anything());
  });

  it('push=false persists only', async () => {
    const { svc, push } = make();
    await svc.create({ ...input, push: false });
    expect(push.send).not.toHaveBeenCalled();
  });
});

describe('owner scoping (a different owner cannot read or modify)', () => {
  it('markRead filters by BOTH id and ownerId', async () => {
    const { svc, model } = make();
    await svc.markRead('o1', 'n1');
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'n1', ownerId: 'o1' },
      expect.anything(),
      expect.anything(),
    );
  });

  it("another owner's notification behaves as not found", async () => {
    const { svc } = make({ markReadResult: null });
    await expect(svc.markRead('attacker', 'n1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('list and unread count are restricted to the owner', async () => {
    const { svc, model } = make();
    await svc.list('o1');
    expect(model.find).toHaveBeenCalledWith({ ownerId: 'o1' });
    expect(model.countDocuments).toHaveBeenCalledWith({
      ownerId: 'o1',
      isRead: false,
    });
  });

  it("markAllRead only touches the owner's unread notifications", async () => {
    const { svc, model } = make();
    expect(await svc.markAllRead('o1')).toEqual({ updated: 3, unreadCount: 0 });
    expect(model.updateMany).toHaveBeenCalledWith(
      { ownerId: 'o1', isRead: false },
      expect.anything(),
    );
  });

  it('markRead keeps the first readAt (idempotent read-state)', async () => {
    const { svc, model } = make();
    await svc.markRead('o1', 'n1');
    const pipeline = model.findOneAndUpdate.mock.calls[0][1];
    expect(pipeline[0].$set.readAt).toEqual({ $ifNull: ['$readAt', '$$NOW'] });
  });

  it('list paginates with a cursor and an over-fetch to detect more pages', async () => {
    const { svc, model } = make();
    model.find.mockReturnValueOnce(
      chain([{ _id: '3' }, { _id: '2' }, { _id: '1' }]),
    );
    const r = await svc.list('o1', { limit: 2 });
    expect(r.items).toHaveLength(2);
    expect(r.nextCursor).toBe('2');
  });
});

describe('push token lifecycle', () => {
  it('registers for the authenticated owner and removes a stale token of the same device (refresh)', async () => {
    const { svc, tokenModel } = make();
    await svc.registerToken('o1', {
      token: 'ExponentPushToken[new]',
      deviceId: 'dev1',
      platform: 'android',
    });
    expect(tokenModel.deleteMany).toHaveBeenCalledWith({
      ownerId: 'o1',
      deviceId: 'dev1',
      token: { $ne: 'ExponentPushToken[new]' },
    });
    expect(tokenModel.findOneAndUpdate).toHaveBeenCalledWith(
      { token: 'ExponentPushToken[new]' },
      {
        $set: expect.objectContaining({
          ownerId: 'o1',
          deviceId: 'dev1',
          isActive: true,
        }),
      },
      { upsert: true },
    );
  });

  it('account switch on the same device re-assigns the token to the new owner (never two owners)', async () => {
    const { svc, tokenModel } = make();
    await svc.registerToken('ownerB', {
      token: 'ExponentPushToken[shared]',
      deviceId: 'dev1',
    });
    expect(tokenModel.findOneAndUpdate.mock.calls[0][1].$set.ownerId).toBe(
      'ownerB',
    );
  });

  it('retries once on a registration race (E11000), then succeeds', async () => {
    const { svc, tokenModel } = make();
    tokenModel.findOneAndUpdate
      .mockRejectedValueOnce(dupErr())
      .mockResolvedValueOnce({});
    await expect(
      svc.registerToken('o1', { token: 'ExponentPushToken[x]', deviceId: 'd' }),
    ).resolves.toEqual({ registered: true });
  });

  it('unregister (logout) is scoped to the owner + device', async () => {
    const { svc, tokenModel } = make();
    await svc.unregisterToken('o1', 'dev1');
    expect(tokenModel.deleteMany).toHaveBeenCalledWith({
      ownerId: 'o1',
      deviceId: 'dev1',
    });
  });
});

describe('preferences', () => {
  it('stores the app-level preference separately from any OS permission', async () => {
    const { svc, settingsModel } = make();
    await svc.updatePreferences('o1', { pushEnabled: true });
    expect(settingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { ownerId: 'o1' },
      expect.objectContaining({ $set: { pushEnabled: true } }),
      expect.anything(),
    );
  });
});
