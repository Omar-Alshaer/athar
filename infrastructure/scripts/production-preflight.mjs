#!/usr/bin/env node
import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = fileURLToPath(new URL('../../', import.meta.url));
const envArg = process.argv.find((arg) => arg.startsWith('--env-file='));
const skipApi = process.argv.includes('--skip-api');
if (envArg) loadEnvFile(envArg.slice('--env-file='.length));

const failures = [];
const passes = [];
const pass = (message) => passes.push(message);
const fail = (message) => failures.push(message);
const value = (name) => String(process.env[name] ?? '').trim();
const required = [
  'DATABASE_URL', 'WEB_ORIGIN', 'ADMIN_ORIGIN', 'API_ORIGIN',
  'SESSION_SECRET', 'XPAY_SECRET_KEY', 'XPAY_WEBHOOK_SECRET',
  'XPAY_API_BASE_URL', 'XPAY_RETURN_URL', 'XPAY_CANCEL_URL',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'DIGITAL_STORAGE_ROOT',
];

if (value('NODE_ENV') === 'production') pass('NODE_ENV=production');
else fail('NODE_ENV must equal production');

for (const name of required) {
  const current = value(name);
  if (!current) fail(`${name} is missing`);
  else if (/YOUR_|PLACEHOLDER|REPLACE_WITH/i.test(current)) fail(`${name} still contains a placeholder`);
  else pass(`${name} is present`);
}

if (value('PAYMENT_PROVIDER').toLowerCase() === 'xpay') pass('PAYMENT_PROVIDER=xpay');
else fail('PAYMENT_PROVIDER must equal xpay');
if (value('MOCK_PAYMENT_ENABLED').toLowerCase() === 'false') pass('MOCK payment is disabled');
else fail('MOCK_PAYMENT_ENABLED must equal false');
if (value('SESSION_SECRET').length >= 48) pass('SESSION_SECRET length is acceptable');
else fail('SESSION_SECRET must contain at least 48 characters');
if (['127.0.0.1', '::1'].includes(value('API_BIND_HOST') || '127.0.0.1')) pass('API binds to loopback');
else fail('API_BIND_HOST must be loopback-only');

const forbiddenHost = /(^|\.)(localhost|local|trycloudflare\.com|vercel\.app)$/i;
const parsedUrls = new Map();
for (const name of ['WEB_ORIGIN', 'ADMIN_ORIGIN', 'API_ORIGIN', 'XPAY_API_BASE_URL', 'XPAY_RETURN_URL', 'XPAY_CANCEL_URL']) {
  try {
    const parsed = new URL(value(name));
    parsedUrls.set(name, parsed);
    if (parsed.protocol !== 'https:' || forbiddenHost.test(parsed.hostname)) fail(`${name} must use a public non-temporary HTTPS host`);
    else pass(`${name} uses HTTPS`);
  } catch {
    fail(`${name} is not a valid absolute URL`);
  }
}

for (const name of ['WEB_ORIGIN', 'ADMIN_ORIGIN', 'API_ORIGIN', 'XPAY_API_BASE_URL']) {
  const parsed = parsedUrls.get(name);
  if (parsed && parsed.origin !== value(name).replace(/\/$/, '')) fail(`${name} must contain only an origin`);
}
if (parsedUrls.get('XPAY_API_BASE_URL')?.hostname === 'api.xpay.app') pass('XPay API uses the official production host');
else fail('XPAY_API_BASE_URL must use api.xpay.app');

const returnHost = parsedUrls.get('XPAY_RETURN_URL')?.hostname;
const cancelHost = parsedUrls.get('XPAY_CANCEL_URL')?.hostname;
const webHost = parsedUrls.get('WEB_ORIGIN')?.hostname;
if (webHost && returnHost === webHost && cancelHost === webHost) pass('XPay return/cancel URLs use the storefront host');
else fail('XPay return/cancel URLs must use WEB_ORIGIN host');

const cookieDomain = value('COOKIE_DOMAIN');
if (!cookieDomain || (!/[:/]/.test(cookieDomain) && !/localhost/i.test(cookieDomain))) pass('COOKIE_DOMAIN is safe or host-only');
else fail('COOKIE_DOMAIN must be blank or a bare production domain');

const storageRoot = value('DIGITAL_STORAGE_ROOT');
if (!isAbsolute(storageRoot)) fail('DIGITAL_STORAGE_ROOT must be absolute');
else {
  try {
    await access(storageRoot, constants.R_OK | constants.W_OK | constants.X_OK);
    pass('Digital storage is readable/writable by the deploy user');
  } catch {
    fail('Digital storage is not readable/writable by the deploy user');
  }
}

let appliedMigrations = [];
if (value('DATABASE_URL')) {
  const client = new pg.Client({ connectionString: value('DATABASE_URL'), connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    pass('Database is reachable');
    const migrations = await client.query(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    );
    appliedMigrations = migrations.rows.map((row) => row.migration_name);
  } catch {
    fail('Database is not reachable');
  } finally {
    await client.end().catch(() => undefined);
  }
}

try {
  const migrationPath = join(root, 'apps/api/prisma/migrations');
  const entries = await readdir(migrationPath, { withFileTypes: true });
  const expectedMigrations = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const applied = [...appliedMigrations].sort();
  if (
    expectedMigrations.length > 0 &&
    expectedMigrations.length === applied.length &&
    expectedMigrations.every((name, index) => name === applied[index])
  ) pass('Prisma migrations are up to date');
  else fail('Prisma migration status is not clean');
} catch {
  fail('Prisma migration status could not be verified');
}

if (!skipApi && parsedUrls.get('API_ORIGIN')) {
  for (const endpoint of ['live', 'ready']) {
    try {
      const response = await fetch(`${parsedUrls.get('API_ORIGIN').origin}/api/health/${endpoint}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      const body = await response.json();
      const healthy = response.ok && (body.status === 'ok' || body.status === 'ready');
      if (healthy && (endpoint !== 'ready' || (body.database === 'ok' && body.privateStorage === 'writable' && body.cloudinary === 'configured'))) {
        pass(`API health/${endpoint} passed`);
      } else fail(`API health/${endpoint} failed`);
    } catch {
      fail(`API health/${endpoint} is unreachable`);
    }
  }
}

for (const message of passes) console.log(`PASS  ${message}`);
for (const message of failures) console.error(`FAIL  ${message}`);
console.log(`\nPASS=${passes.length} FAIL=${failures.length}`);
process.exitCode = failures.length ? 1 : 0;
