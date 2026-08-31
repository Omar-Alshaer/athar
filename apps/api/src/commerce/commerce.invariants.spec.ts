import assert from 'node:assert/strict';
import test from 'node:test';
import { CommerceService } from './commerce.service';

const service = new CommerceService({} as never, {} as never, {} as never);
const callInvariant = (session: Record<string, unknown>) =>
  (service as unknown as {
    assertXPaySessionMatchesPayment: (session: unknown, payment: unknown) => void;
  }).assertXPaySessionMatchesPayment(session, {
    amount: '500.00',
    currency: 'EGP',
    order: { id: 'order-id', orderNumber: 'ATHR-1', userId: 'user-id' },
  });

const validSession = {
  id: 'cs_test',
  currency: 'EGP',
  amountTotal: 50000,
  metadata: { orderId: 'order-id', orderNumber: 'ATHR-1', userId: 'user-id' },
};

test('accepts only exact server-authoritative XPay order data', () => {
  assert.doesNotThrow(() => callInvariant(validSession));
  assert.doesNotThrow(() => callInvariant({
    ...validSession,
    presentmentDetails: {
      currency: 'EGP', amountSubtotal: 50000, amountTotal: 50000, amountDiscount: 0,
    },
  }));
});

test('rejects metadata, currency, amount, rounding, and discount mismatches', () => {
  const invalid = [
    { ...validSession, metadata: { ...validSession.metadata, userId: 'attacker' } },
    { ...validSession, currency: 'USD' },
    { ...validSession, amountTotal: 49999 },
    { ...validSession, amountTotal: 50001 },
    {
      ...validSession,
      presentmentDetails: {
        currency: 'EGP', amountSubtotal: 50000, amountTotal: 49999, amountDiscount: 0,
      },
    },
    {
      ...validSession,
      presentmentDetails: {
        currency: 'EGP', amountSubtotal: 50000, amountTotal: 50000, amountDiscount: 1,
      },
    },
  ];
  for (const session of invalid) assert.throws(() => callInvariant(session));
});

test('rejects duplicate product lines and quantity above one', () => {
  const normalize = (items: unknown[]) =>
    (service as unknown as { normalizeItems: (items: unknown[]) => unknown }).normalizeItems(items);
  assert.throws(() => normalize([{ slug: 'book', quantity: 2 }]));
  assert.throws(() => normalize([{ slug: 'book', quantity: 1 }, { slug: 'book', quantity: 1 }]));
});
