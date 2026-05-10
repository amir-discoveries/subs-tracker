import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/commands/total.js';
import { inMemoryStore, captureIo } from '../helpers.js';

test('total: empty store prints empty-state message', async () => {
  const store = inMemoryStore([]);
  const { io, stdout } = captureIo();
  await run([], { store, io });
  assert.equal(stdout(), 'No subscriptions yet.\n');
});

test('total: groups by currency, then by category, with totals', async () => {
  const subs = [
    { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'Entertainment', renewalDay: 14, addedAt: 'a' },
    { name: 'Spotify', cost: 9.99, currency: 'USD', category: 'Entertainment', renewalDay: 3, addedAt: 'b' },
    { name: 'Notion', cost: 12.0, currency: 'USD', category: 'Productivity', renewalDay: 1, addedAt: 'c' },
    { name: 'Zeit', cost: 5.0, currency: 'EUR', category: 'Productivity', renewalDay: 5, addedAt: 'd' },
  ];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io });
  const out = stdout();

  // EUR comes before USD alphabetically
  const eurIdx = out.indexOf('EUR');
  const usdIdx = out.indexOf('USD');
  assert.ok(eurIdx >= 0 && usdIdx >= 0 && eurIdx < usdIdx, 'currencies must be alphabetical');

  // Categories listed
  assert.match(out, /Entertainment\s+25\.98 \/ mo\s+311\.76 \/ yr/);
  assert.match(out, /Productivity\s+12\.00 \/ mo\s+144\.00 \/ yr/);

  // USD total = 25.98 + 12.00 = 37.98
  assert.match(out, /Total\s+37\.98 \/ mo\s+455\.76 \/ yr/);

  // EUR total
  assert.match(out, /Total\s+5\.00 \/ mo\s+60\.00 \/ yr/);
});

test('total: yearly is monthly * 12 exactly', async () => {
  const subs = [
    { name: 'X', cost: 1.5, currency: 'USD', category: 'A', renewalDay: 1, addedAt: 'a' },
  ];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io });
  assert.match(stdout(), /1\.50 \/ mo\s+18\.00 \/ yr/);
});
