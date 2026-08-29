import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInternationalPhone } from './phone.util';

const cases = [
  ['Saudi Arabia', '0501234567', 'SA', '+966501234567'],
  ['Egypt', '01012345678', 'EG', '+201012345678'],
  ['France', '06 12 34 56 78', 'FR', '+33612345678'],
  ['United States', '(415) 555-2671', 'US', '+14155552671'],
] as const;

for (const [label, input, country, expected] of cases) {
  test(`normalizes ${label} to E.164`, () => {
    assert.deepEqual(normalizeInternationalPhone(input, country), {
      phone: expected,
      phoneCountry: country,
    });
  });
}

test('rejects an invalid number', () => {
  assert.throws(() => normalizeInternationalPhone('123', 'SA'));
});

test('rejects a valid number paired with the wrong country', () => {
  assert.throws(() => normalizeInternationalPhone('+33612345678', 'US'));
});

test('rejects frontend-validation bypass content', () => {
  assert.throws(() => normalizeInternationalPhone('+966501234567<script>', 'SA'));
  assert.throws(() => normalizeInternationalPhone('+966501234567', 'ZZ'));
});
