import assert from 'node:assert/strict';
import test from 'node:test';
import { CommerceService } from './commerce.service';

const service = new CommerceService({} as never, {} as never, {} as never);

const callInvariant = (session: Record<string, unknown>) =>
  (service as unknown as {
    assertXPaySessionMatchesPayment: (session: unknown, payment: unknown) => void;
  }).assertXPaySessionMatchesPayment(session, {
    amount: '39.99',
    currency: 'SAR',
    order: {
      id: 'order-id',
      orderNumber: 'ATHR-1',
      userId: 'user-id',
    },
  });

const validSession = {
  id: 'cs_test',
  currency: 'EGP',
  amountTotal: 54000,
  presentmentDetails: {
    currency: 'SAR',
    amountSubtotal: 3999,
    amountTotal: 3999,
    amountDiscount: 0,
  },
  metadata: {
    orderId: 'order-id',
    orderNumber: 'ATHR-1',
    userId: 'user-id',
  },
};

test('accepts exact SAR XPay presentment data', () => {
  assert.doesNotThrow(() => callInvariant(validSession));
  assert.doesNotThrow(() =>
    callInvariant({
      ...validSession,
      currency: 'SAR',
      amountTotal: 3999,
      presentmentDetails: null,
    }),
  );
});

test('rejects metadata, currency, amount, rounding, and discount mismatches', () => {
  const invalid = [
    {
      ...validSession,
      metadata: { ...validSession.metadata, userId: 'attacker' },
    },
    {
      ...validSession,
      presentmentDetails: { ...validSession.presentmentDetails, currency: 'USD' },
    },
    {
      ...validSession,
      presentmentDetails: { ...validSession.presentmentDetails, amountSubtotal: 3998 },
    },
    {
      ...validSession,
      presentmentDetails: { ...validSession.presentmentDetails, amountTotal: 3998 },
    },
    {
      ...validSession,
      presentmentDetails: { ...validSession.presentmentDetails, amountDiscount: 1 },
    },
    {
      ...validSession,
      currency: 'EGP',
      amountTotal: 3999,
      presentmentDetails: null,
    },
  ];

  for (const session of invalid) assert.throws(() => callInvariant(session));
});

test('rejects duplicate product lines and quantity above one', () => {
  const normalize = (items: unknown[]) =>
    (service as unknown as { normalizeItems: (items: unknown[]) => unknown }).normalizeItems(items);
  assert.throws(() => normalize([{ slug: 'book', quantity: 2 }]));
  assert.throws(() => normalize([
    { slug: 'book', quantity: 1 },
    { slug: 'book', quantity: 1 },
  ]));
});
