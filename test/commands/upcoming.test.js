import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/commands/upcoming.js';
import { inMemoryStore, captureIo } from '../helpers.js';

test('upcoming: empty list prints empty-state message', async () => {
  const store = inMemoryStore([]);
  const { io, stdout } = captureIo();
  await run([], { store, io, now: new Date(2026, 4, 10) });
  assert.equal(stdout(), 'No renewals in the next 7 days.\n');
});

test('upcoming: shows sub renewing today', async () => {
  const subs = [{ name: 'Netflix', cost: 15.99, currency: 'USD', category: 'V', renewalDay: 10, addedAt: 'a' }];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io, now: new Date(2026, 4, 10) });
  assert.match(stdout(), /Netflix — renews 2026-05-10 \(today\)/);
});

test('upcoming: shows sub renewing in exactly 7 days (boundary inclusive)', async () => {
  const subs = [{ name: 'A', cost: 1, currency: 'USD', category: 'X', renewalDay: 17, addedAt: 'a' }];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io, now: new Date(2026, 4, 10) });
  assert.match(stdout(), /A — renews 2026-05-17 \(in 7 days\)/);
});

test('upcoming: excludes sub renewing in 8 days', async () => {
  const subs = [{ name: 'A', cost: 1, currency: 'USD', category: 'X', renewalDay: 18, addedAt: 'a' }];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io, now: new Date(2026, 4, 10) });
  assert.equal(stdout(), 'No renewals in the next 7 days.\n');
});

test('upcoming: handles end-of-month clamping (day 31 in Feb)', async () => {
  const subs = [{ name: 'A', cost: 1, currency: 'USD', category: 'X', renewalDay: 31, addedAt: 'a' }];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io, now: new Date(2026, 1, 25) });
  assert.match(stdout(), /A — renews 2026-02-28 \(in 3 days\)/);
});

test('upcoming: sorted by date ascending', async () => {
  const subs = [
    { name: 'B', cost: 1, currency: 'USD', category: 'X', renewalDay: 16, addedAt: 'a' },
    { name: 'A', cost: 1, currency: 'USD', category: 'X', renewalDay: 12, addedAt: 'b' },
  ];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io, now: new Date(2026, 4, 10) });
  const lines = stdout().trimEnd().split('\n');
  assert.match(lines[0], /^A/);
  assert.match(lines[1], /^B/);
});
