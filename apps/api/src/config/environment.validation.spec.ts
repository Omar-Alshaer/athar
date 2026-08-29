import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRuntimeEnvironment } from './environment.validation';

const productionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://athr:secret@127.0.0.1:5432/athr',
  WEB_ORIGIN: 'https://store.example.org',
  ADMIN_ORIGIN: 'https://admin.example.org',
  API_ORIGIN: 'https://api.example.org',
  COOKIE_DOMAIN: '',
  SESSION_SECRET: 'x'.repeat(64),
  PAYMENT_PROVIDER: 'xpay',
  MOCK_PAYMENT_ENABLED: 'false',
  XPAY_SECRET_KEY: 'xpay-secret',
  XPAY_WEBHOOK_SECRET: 'xpay-webhook-secret',
  XPAY_API_BASE_URL: 'https://api.xpay.app',
  XPAY_RETURN_URL: 'https://store.example.org/account.html?payment=return',
  XPAY_CANCEL_URL: 'https://store.example.org/checkout.html?payment=cancelled',
  CLOUDINARY_CLOUD_NAME: 'cloud',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
  DIGITAL_STORAGE_ROOT: '/var/lib/athr/private',
  API_BIND_HOST: '127.0.0.1',
};

function withEnvironment(overrides: Record<string, string>, callback: () => void): void {
  const keys = new Set([...Object.keys(productionEnv), ...Object.keys(overrides)]);
  const previous = new Map([...keys].map((key) => [key, process.env[key]]));
  Object.assign(process.env, productionEnv, overrides);
  try {
    callback();
  } finally {
    for (const [key, oldValue] of previous) {
      if (oldValue === undefined) delete process.env[key];
      else process.env[key] = oldValue;
    }
  }
}

test('accepts a complete fail-closed production configuration', () => {
  withEnvironment({}, () => assert.doesNotThrow(validateRuntimeEnvironment));
});

test('rejects MOCK in production even when explicitly enabled', () => {
  withEnvironment(
    { PAYMENT_PROVIDER: 'mock', MOCK_PAYMENT_ENABLED: 'true' },
    () => assert.throws(validateRuntimeEnvironment, /PAYMENT_PROVIDER=xpay/),
  );
});

test('rejects temporary and localhost production origins', () => {
  withEnvironment(
    { WEB_ORIGIN: 'https://athr.trycloudflare.com' },
    () => assert.throws(validateRuntimeEnvironment, /public HTTPS host/),
  );
  withEnvironment(
    { API_ORIGIN: 'http://localhost:4000' },
    () => assert.throws(validateRuntimeEnvironment, /public HTTPS host/),
  );
});

test('rejects a publicly bound production API', () => {
  withEnvironment(
    { API_BIND_HOST: '0.0.0.0' },
    () => assert.throws(validateRuntimeEnvironment, /loopback-only/),
  );
});
