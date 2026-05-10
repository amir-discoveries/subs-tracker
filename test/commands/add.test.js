import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/commands/add.js';
import { inMemoryStore, captureIo } from '../helpers.js';
import { UserError } from '../../src/errors.js';

test('add: happy path stores normalized subscription', async () => {
  const store = inMemoryStore([]);
  const { io, stdout, remaining } = captureIo([
    'Netflix', '15.99', 'USD', 'Entertainment', '14',
  ]);
  await run([], { store, io });
  const subs = await store.load();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].name, 'Netflix');
  assert.equal(subs[0].cost, 15.99);
  assert.equal(subs[0].currency, 'USD');
  assert.equal(subs[0].category, 'Entertainment');
  assert.equal(subs[0].renewalDay, 14);
  assert.match(subs[0].addedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(stdout(), /Added "Netflix"/);
  assert.equal(remaining(), 0);
});

test('add: trims whitespace on string fields', async () => {
  const store = inMemoryStore([]);
  const { io } = captureIo([
    '  Netflix  ', '15.99', 'USD', '  Entertainment ', '14',
  ]);
  await run([], { store, io });
  const subs = await store.load();
  assert.equal(subs[0].name, 'Netflix');
  assert.equal(subs[0].category, 'Entertainment');
});

test('add: empty currency uses default USD', async () => {
  const store = inMemoryStore([]);
  const { io } = captureIo([
    'Netflix', '15.99', '', 'Entertainment', '14',
  ]);
  await run([], { store, io });
  const subs = await store.load();
  assert.equal(subs[0].currency, 'USD');
});

test('add: lowercases currency input then uppercases', async () => {
  const store = inMemoryStore([]);
  const { io } = captureIo([
    'X', '1', 'eur', 'C', '1',
  ]);
  await run([], { store, io });
  const subs = await store.load();
  assert.equal(subs[0].currency, 'EUR');
});

test('add: rejects duplicate name (case-insensitive) by reprompting', async () => {
  const existing = { name: 'Netflix', cost: 1, currency: 'USD', category: 'X', renewalDay: 1, addedAt: 'a' };
  const store = inMemoryStore([existing]);
  const { io, stderr } = captureIo([
    'NETFLIX',  // duplicate -> reject, reprompt
    'Hulu',     // accepted
    '5.99', 'USD', 'Entertainment', '10',
  ]);
  await run([], { store, io });
  assert.match(stderr(), /already exists/);
  const subs = await store.load();
  assert.equal(subs.length, 2);
  assert.equal(subs[1].name, 'Hulu');
});

test('add: reprompts on invalid cost (non-numeric, then negative, then too many decimals)', async () => {
  const store = inMemoryStore([]);
  const { io, stderr } = captureIo([
    'X',
    'abc',     // non-numeric
    '-1',      // negative
    '1.234',   // too many decimals
    '1.99',    // valid
    'USD', 'C', '1',
  ]);
  await run([], { store, io });
  const errs = stderr();
  assert.match(errs, /positive number/);
  const subs = await store.load();
  assert.equal(subs[0].cost, 1.99);
});

test('add: reprompts on invalid currency (non 3-letter)', async () => {
  const store = inMemoryStore([]);
  const { io, stderr } = captureIo([
    'X', '1',
    'US',     // too short
    'USDD',   // too long
    'US1',    // not letters
    'USD',    // valid
    'C', '1',
  ]);
  await run([], { store, io });
  assert.match(stderr(), /3 letters/);
  const subs = await store.load();
  assert.equal(subs[0].currency, 'USD');
});

test('add: reprompts on invalid renewal day (0, 32, non-integer)', async () => {
  const store = inMemoryStore([]);
  const { io, stderr } = captureIo([
    'X', '1', 'USD', 'C',
    '0',      // out of range low
    '32',     // out of range high
    'abc',    // not number
    '15',     // valid
  ]);
  await run([], { store, io });
  assert.match(stderr(), /1 and 31/);
  const subs = await store.load();
  assert.equal(subs[0].renewalDay, 15);
});

test('add: empty name reprompts', async () => {
  const store = inMemoryStore([]);
  const { io, stderr } = captureIo([
    '',
    'X', '1', 'USD', 'C', '1',
  ]);
  await run([], { store, io });
  assert.match(stderr(), /Name cannot be empty/);
  const subs = await store.load();
  assert.equal(subs[0].name, 'X');
});

test('add: empty category reprompts', async () => {
  const store = inMemoryStore([]);
  const { io, stderr } = captureIo([
    'X', '1', 'USD',
    '',
    'Cats', '1',
  ]);
  await run([], { store, io });
  assert.match(stderr(), /Category cannot be empty/);
  const subs = await store.load();
  assert.equal(subs[0].category, 'Cats');
});
