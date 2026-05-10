import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/commands/remove.js';
import { inMemoryStore, captureIo } from '../helpers.js';
import { UserError } from '../../src/errors.js';

test('remove: removes by exact name', async () => {
  const store = inMemoryStore([
    { name: 'Netflix', cost: 1, currency: 'USD', category: 'X', renewalDay: 1, addedAt: 'a' },
    { name: 'Spotify', cost: 1, currency: 'USD', category: 'X', renewalDay: 2, addedAt: 'b' },
  ]);
  const { io, stdout } = captureIo();
  await run(['Netflix'], { store, io });
  assert.match(stdout(), /Removed "Netflix"/);
  const remaining = await store.load();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].name, 'Spotify');
});

test('remove: case-insensitive match', async () => {
  const store = inMemoryStore([
    { name: 'Netflix', cost: 1, currency: 'USD', category: 'X', renewalDay: 1, addedAt: 'a' },
  ]);
  const { io } = captureIo();
  await run(['NETFLIX'], { store, io });
  const remaining = await store.load();
  assert.equal(remaining.length, 0);
});

test('remove: missing name throws UserError', async () => {
  const store = inMemoryStore([]);
  const { io } = captureIo();
  await assert.rejects(() => run(['Ghost'], { store, io }), (err) => {
    assert.ok(err instanceof UserError);
    assert.match(err.message, /not found/);
    return true;
  });
});

test('remove: no arg throws UserError with usage', async () => {
  const store = inMemoryStore([]);
  const { io } = captureIo();
  await assert.rejects(() => run([], { store, io }), (err) => {
    assert.ok(err instanceof UserError);
    assert.match(err.message, /Usage:/);
    return true;
  });
});

test('remove: only the matched sub is removed', async () => {
  const store = inMemoryStore([
    { name: 'A', cost: 1, currency: 'USD', category: 'X', renewalDay: 1, addedAt: 'a' },
    { name: 'B', cost: 2, currency: 'USD', category: 'X', renewalDay: 2, addedAt: 'b' },
    { name: 'C', cost: 3, currency: 'USD', category: 'X', renewalDay: 3, addedAt: 'c' },
  ]);
  const { io } = captureIo();
  await run(['B'], { store, io });
  const remaining = await store.load();
  assert.deepEqual(remaining.map((s) => s.name), ['A', 'C']);
});
