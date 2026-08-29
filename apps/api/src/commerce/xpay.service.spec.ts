import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { XPayService } from './xpay.service';

const secret = 'unit-test-webhook-secret';
const event = {
  id: 'evt_test_1',
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_test_1', paymentStatus: 'paid' } },
};

function signature(raw: Buffer, timestamp = Math.floor(Date.now() / 1000)): string {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(raw)
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

test('verifies a valid signed raw XPay event', () => {
  const previous = process.env.XPAY_WEBHOOK_SECRET;
  process.env.XPAY_WEBHOOK_SECRET = secret;
  try {
    const raw = Buffer.from(JSON.stringify(event));
    assert.deepEqual(new XPayService().verifyWebhook(raw, signature(raw)), event);
  } finally {
    if (previous === undefined) delete process.env.XPAY_WEBHOOK_SECRET;
    else process.env.XPAY_WEBHOOK_SECRET = previous;
  }
});

test('rejects tampered, stale, and missing XPay signatures', () => {
  const previous = process.env.XPAY_WEBHOOK_SECRET;
  process.env.XPAY_WEBHOOK_SECRET = secret;
  const service = new XPayService();
  const raw = Buffer.from(JSON.stringify(event));
  try {
    assert.throws(() => service.verifyWebhook(Buffer.concat([raw, Buffer.from(' ')]), signature(raw)));
    assert.throws(() => service.verifyWebhook(raw, signature(raw, Math.floor(Date.now() / 1000) - 301)));
    assert.throws(() => service.verifyWebhook(raw, undefined));
  } finally {
    if (previous === undefined) delete process.env.XPAY_WEBHOOK_SECRET;
    else process.env.XPAY_WEBHOOK_SECRET = previous;
  }
});
