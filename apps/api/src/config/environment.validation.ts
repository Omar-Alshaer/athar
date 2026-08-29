import { isAbsolute } from 'node:path';

const productionRequired = [
  'DATABASE_URL',
  'WEB_ORIGIN',
  'ADMIN_ORIGIN',
  'API_ORIGIN',
  'SESSION_SECRET',
  'XPAY_SECRET_KEY',
  'XPAY_WEBHOOK_SECRET',
  'XPAY_API_BASE_URL',
  'XPAY_RETURN_URL',
  'XPAY_CANCEL_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'DIGITAL_STORAGE_ROOT',
] as const;

const forbiddenHostPattern = /(^|\.)(localhost|local|trycloudflare\.com|vercel\.app)$/i;

function required(name: string): string {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} is required in production.`);
  return value;
}

function httpsUrl(name: string, originOnly = false): URL {
  const raw = required(name);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
  if (parsed.protocol !== 'https:' || forbiddenHostPattern.test(parsed.hostname)) {
    throw new Error(`${name} must use a public HTTPS host.`);
  }
  if (originOnly && parsed.origin !== raw.replace(/\/$/, '')) {
    throw new Error(`${name} must contain an origin only (no path, query, or fragment).`);
  }
  return parsed;
}

export function validateRuntimeEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;

  for (const name of productionRequired) required(name);

  if (String(process.env.PAYMENT_PROVIDER).trim().toLowerCase() !== 'xpay') {
    throw new Error('Production requires PAYMENT_PROVIDER=xpay.');
  }
  if (String(process.env.MOCK_PAYMENT_ENABLED).trim().toLowerCase() !== 'false') {
    throw new Error('Production requires MOCK_PAYMENT_ENABLED=false.');
  }

  const sessionSecret = required('SESSION_SECRET');
  if (sessionSecret.length < 48) {
    throw new Error('SESSION_SECRET must contain at least 48 characters in production.');
  }

  httpsUrl('WEB_ORIGIN', true);
  httpsUrl('ADMIN_ORIGIN', true);
  httpsUrl('API_ORIGIN', true);
  const xpayBase = httpsUrl('XPAY_API_BASE_URL', true);
  if (xpayBase.hostname !== 'api.xpay.app') {
    throw new Error('XPAY_API_BASE_URL must use the official api.xpay.app host in production.');
  }
  httpsUrl('XPAY_RETURN_URL');
  httpsUrl('XPAY_CANCEL_URL');

  const bindHost = String(process.env.API_BIND_HOST ?? '127.0.0.1').trim();
  if (!['127.0.0.1', '::1'].includes(bindHost)) {
    throw new Error('API_BIND_HOST must be loopback-only in production.');
  }

  const storageRoot = required('DIGITAL_STORAGE_ROOT');
  if (!isAbsolute(storageRoot)) {
    throw new Error('DIGITAL_STORAGE_ROOT must be an absolute path in production.');
  }

  const cookieDomain = String(process.env.COOKIE_DOMAIN ?? '').trim();
  if (cookieDomain && (/[:/]/.test(cookieDomain) || /localhost/i.test(cookieDomain))) {
    throw new Error('COOKIE_DOMAIN must be a domain name without a scheme or path.');
  }
}
