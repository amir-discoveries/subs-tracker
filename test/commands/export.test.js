import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/commands/export.js';
import { inMemoryStore, captureIo } from '../helpers.js';
import { UserError } from '../../src/errors.js';

const SAMPLE = [
  { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'Entertainment', renewalDay: 14, addedAt: '2026-05-10T12:00:00.000Z' },
  { name: 'Comma, Inc', cost: 9.99, currency: 'USD', category: 'Tools', renewalDay: 3, addedAt: '2026-05-09T12:00:00.000Z' },
];

test('export: writes header + rows to stdout when no path', async () => {
  const store = inMemoryStore(SAMPLE);
  const { io, stdout, stderr } = captureIo();
  await run([], { store, io });
  assert.equal(
    stdout(),
    'name,cost,currency,category,renewalDay,addedAt\n' +
      'Netflix,15.99,USD,Entertainment,14,2026-05-10T12:00:00.000Z\n' +
      '"Comma, Inc",9.99,USD,Tools,3,2026-05-09T12:00:00.000Z\n'
  );
  assert.equal(stderr(), '');
});

test('export: with empty store writes header only', async () => {
  const store = inMemoryStore([]);
  const { io, stdout } = captureIo();
  await run([], { store, io });
  assert.equal(stdout(), 'name,cost,currency,category,renewalDay,addedAt\n');
});

test('export: with path writes file and prints message to stderr', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'subs-export-'));
  try {
    const path = join(dir, 'out.csv');
    const store = inMemoryStore(SAMPLE);
    const { io, stdout, stderr } = captureIo();
    await run([path], { store, io });
    assert.equal(stdout(), '');
    assert.match(stderr(), /Exported 2 subscriptions to /);
    const content = await readFile(path, 'utf8');
    assert.match(content, /^name,cost,currency,category,renewalDay,addedAt\n/);
    assert.match(content, /Netflix,15\.99,USD,Entertainment,14,/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('export: empty store with path reports 0 subscriptions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'subs-export-'));
  try {
    const path = join(dir, 'out.csv');
    const store = inMemoryStore([]);
    const { io, stderr } = captureIo();
    await run([path], { store, io });
    assert.match(stderr(), /Exported 0 subscriptions to /);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('export: throws UserError when target directory does not exist', async () => {
  const store = inMemoryStore(SAMPLE);
  const { io } = captureIo();
  const badPath = '/nonexistent-dir-xyz-9876/out.csv';
  await assert.rejects(() => run([badPath], { store, io }), (err) => {
    assert.ok(err instanceof UserError);
    assert.match(err.message, /does not exist/);
    return true;
  });
});
