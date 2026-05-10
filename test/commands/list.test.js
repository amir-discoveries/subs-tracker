import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/commands/list.js';
import { inMemoryStore, captureIo } from '../helpers.js';

test('list: empty store prints empty-state message', async () => {
  const store = inMemoryStore([]);
  const { io, stdout } = captureIo();
  await run([], { store, io });
  assert.equal(stdout(), "No subscriptions yet. Run 'subs add' to add one.\n");
});

test('list: sorted by cost descending', async () => {
  const subs = [
    { name: 'Spotify', cost: 9.99, currency: 'USD', category: 'Music', renewalDay: 3, addedAt: 'a' },
    { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'Video', renewalDay: 14, addedAt: 'b' },
    { name: 'NYT', cost: 4.0, currency: 'USD', category: 'News', renewalDay: 1, addedAt: 'c' },
  ];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io });
  const lines = stdout().trimEnd().split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^NAME/);
  assert.match(lines[1], /^Netflix/);
  assert.match(lines[2], /^Spotify/);
  assert.match(lines[3], /^NYT/);
});

test('list: ties preserve original insertion order', async () => {
  const subs = [
    { name: 'A', cost: 5, currency: 'USD', category: 'X', renewalDay: 1, addedAt: 'a' },
    { name: 'B', cost: 5, currency: 'USD', category: 'X', renewalDay: 2, addedAt: 'b' },
  ];
  const store = inMemoryStore(subs);
  const { io, stdout } = captureIo();
  await run([], { store, io });
  const lines = stdout().trimEnd().split('\n');
  assert.match(lines[1], /^A/);
  assert.match(lines[2], /^B/);
});
