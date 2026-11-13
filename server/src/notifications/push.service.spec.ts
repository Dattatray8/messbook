import { PushService } from './push.service';

const chain = (v: any) => {
  const c: any = {
    limit: () => c,
    lean: () => Promise.resolve(v),
    then: (r: any, j: any) => Promise.resolve(v).then(r, j),
  };
  return c;
};
const res = (status: number, body: any = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as any;
const toks = [
  { _id: 't1', token: 'ExponentPushToken[a]' },
  { _id: 't2', token: 'ExponentPushToken[b]' },
];
const msg = { title: 'T', body: 'B', data: { notificationId: 'n1' } };

function make(pending: any[] = []) {
  const tokenModel: any = {
    updateOne: jest.fn().mockResolvedValue({}),
    find: jest.fn(() => chain([])),
  };
  const notificationModel: any = {
    find: jest.fn(() => chain(pending)),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  return {
    svc: new PushService(tokenModel, notificationModel),
    tokenModel,
    notificationModel,
  };
}

describe('PushService.send', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.EXPO_ACCESS_TOKEN;
  });

  it('returns SKIPPED when there are no tokens (no permission / no device) without calling Expo', async () => {
    global.fetch = jest.fn() as any;
    const { svc } = make();
    expect(await svc.send([], msg)).toMatchObject({
      status: 'SKIPPED',
      reason: 'no_active_tokens',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('collects ok tickets', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      res(200, {
        data: [
          { status: 'ok', id: 'tk1' },
          { status: 'ok', id: 'tk2' },
        ],
      }),
    ) as any;
    const out = await make().svc.send(toks, msg);
    expect(out.status).toBe('SENT');
    expect(out.tickets).toEqual([
      { ticketId: 'tk1', tokenId: 't1' },
      { ticketId: 'tk2', tokenId: 't2' },
    ]);
  });

  it('retries transient errors (500) with a bound, then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(res(500))
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(
        res(200, { data: [{ status: 'ok', id: 'tk' }] }),
      ) as any;
    const out = await make().svc.send([toks[0]], msg);
    expect(out.status).toBe('SENT');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up after the bounded retries and returns FAILED instead of throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue(res(503)) as any;
    const out = await make().svc.send([toks[0]], msg);
    expect(out).toMatchObject({ status: 'FAILED', reason: 'delivery_error' });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry permanent client errors (400)', async () => {
    global.fetch = jest.fn().mockResolvedValue(res(400)) as any;
    const out = await make().svc.send([toks[0]], msg);
    expect(out.status).toBe('FAILED');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('survives a network exception without throwing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as any;
    await expect(make().svc.send([toks[0]], msg)).resolves.toMatchObject({
      status: 'FAILED',
    });
  });

  it('deactivates a token Expo reports as DeviceNotRegistered at send time', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      res(200, {
        data: [
          { status: 'error', details: { error: 'DeviceNotRegistered' } },
          { status: 'ok', id: 'tk' },
        ],
      }),
    ) as any;
    const { svc, tokenModel } = make();
    await svc.send(toks, msg);
    expect(tokenModel.updateOne).toHaveBeenCalledWith(
      { _id: 't1' },
      {
        $set: expect.objectContaining({
          isActive: false,
          deactivatedReason: 'DeviceNotRegistered',
        }),
      },
    );
    expect(tokenModel.updateOne).not.toHaveBeenCalledWith(
      { _id: 't2' },
      expect.anything(),
    );
  });

  it('chunks requests at 100 messages', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      _id: `t${i}`,
      token: `ExponentPushToken[${i}]`,
    }));
    global.fetch = jest.fn().mockImplementation(async (_u: string, init: any) =>
      res(200, {
        data: JSON.parse(init.body).map((_: any, i: number) => ({
          status: 'ok',
          id: `x${i}`,
        })),
      }),
    ) as any;
    await make().svc.send(many, msg);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('sends the optional Expo access token only as an Authorization header and never in the body', async () => {
    process.env.EXPO_ACCESS_TOKEN = 'secret-expo-token';
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        res(200, { data: [{ status: 'ok', id: 'a' }] }),
      ) as any;
    await make().svc.send([toks[0]], msg);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer secret-expo-token');
    expect(init.body).not.toContain('secret-expo-token');
  });

  it('payload carries ids only (no customer data)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        res(200, { data: [{ status: 'ok', id: 'a' }] }),
      ) as any;
    await make().svc.send([toks[0]], msg);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body[0].data).toEqual({ notificationId: 'n1' });
  });
});

describe('PushService.processReceipts', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const pending = [
    {
      _id: 'n1',
      push: {
        attemptedAt: new Date(Date.now() - 3600_000),
        tickets: [{ ticketId: 'tk1', tokenId: 't1' }],
      },
    },
  ];

  it('deactivates tokens whose receipt says DeviceNotRegistered and marks receipts checked', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      res(200, {
        data: {
          tk1: { status: 'error', details: { error: 'DeviceNotRegistered' } },
        },
      }),
    ) as any;
    const { svc, tokenModel, notificationModel } = make(pending);
    expect(await svc.processReceipts()).toEqual({ checked: 1, deactivated: 1 });
    expect(tokenModel.updateOne).toHaveBeenCalledWith(
      { _id: 't1' },
      { $set: expect.objectContaining({ isActive: false }) },
    );
    expect(notificationModel.updateOne).toHaveBeenCalledWith(
      { _id: 'n1' },
      { $set: { 'push.receiptsChecked': true } },
    );
  });

  it('a transient receipt failure leaves it unchecked for the next run (no throw)', async () => {
    global.fetch = jest.fn().mockResolvedValue(res(500)) as any;
    const { svc, notificationModel } = make(pending);
    await expect(svc.processReceipts()).resolves.toEqual({
      checked: 0,
      deactivated: 0,
    });
    expect(notificationModel.updateOne).not.toHaveBeenCalled();
  });

  it('only looks at notifications sent at least 15 minutes ago', async () => {
    global.fetch = jest.fn() as any;
    const { svc, notificationModel } = make([]);
    await svc.processReceipts();
    const q = notificationModel.find.mock.calls[0][0];
    expect(q['push.status']).toBe('SENT');
    expect(q['push.receiptsChecked']).toBe(false);
    expect(
      Date.now() - q['push.attemptedAt'].$lte.getTime(),
    ).toBeGreaterThanOrEqual(15 * 60 * 1000 - 50);
  });
});
