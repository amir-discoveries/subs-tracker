import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, DEFAULT_DATA_PATH } from '../src/store.js';
import { SystemError } from '../src/errors.js';

async function tempPath() {
  const dir = await mkdtemp(join(tmpdir(), 'subs-store-'));
  return { dir, path: join(dir, 'data.json'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('DEFAULT_DATA_PATH ends with .subs/data.json', () => {
  assert.match(DEFAULT_DATA_PATH, /\.subs\/data\.json$/);
});

test('load returns empty array when file does not exist', async () => {
  const { path, cleanup } = await tempPath();
  try {
    const store = createStore(path);
    assert.deepEqual(await store.load(), []);
  } finally {
    await cleanup();
  }
});

test('save then load round-trips subscriptions', async () => {
  const { path, cleanup } = await tempPath();
  try {
    const store = createStore(path);
    const subs = [
      { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'Entertainment', renewalDay: 14, addedAt: '2026-05-10T12:00:00.000Z' },
    ];
    await store.save(subs);
    assert.deepEqual(await store.load(), subs);
  } finally {
    await cleanup();
  }
});

test('save writes versioned JSON file', async () => {
  const { path, cleanup } = await tempPath();
  try {
    const store = createStore(path);
    await store.save([]);
    const raw = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(raw.version, 1);
    assert.deepEqual(raw.subscriptions, []);
  } finally {
    await cleanup();
  }
});

test('load throws SystemError on malformed JSON', async () => {
  const { dir, path, cleanup } = await tempPath();
  try {
    await writeFile(path, '{not json', 'utf8');
    const store = createStore(path);
    await assert.rejects(() => store.load(), (err) => {
      assert.ok(err instanceof SystemError);
      assert.match(err.message, /not valid JSON/);
      return true;
    });
  } finally {
    await cleanup();
  }
});

test('load throws SystemError on unexpected shape', async () => {
  const { path, cleanup } = await tempPath();
  try {
    await writeFile(path, '{"version":1}', 'utf8');
    const store = createStore(path);
    await assert.rejects(() => store.load(), SystemError);
  } finally {
    await cleanup();
  }
});

test('save creates parent directory if missing', async () => {
  const { dir, cleanup } = await tempPath();
  try {
    const nested = join(dir, 'nested', 'deeper', 'data.json');
    const store = createStore(nested);
    await store.save([]);
    assert.deepEqual(await store.load(), []);
  } finally {
    await cleanup();
  }
});

test('save leaves no .tmp file behind on success', async () => {
  const { dir, path, cleanup } = await tempPath();
  try {
    const store = createStore(path);
    await store.save([]);
    const entries = await readdir(dir);
    assert.ok(!entries.some((f) => f.endsWith('.tmp')), `unexpected tmp file: ${entries.join(', ')}`);
  } finally {
    await cleanup();
  }
});

test('sequential saves preserve last write', async () => {
  const { path, cleanup } = await tempPath();
  try {
    const store = createStore(path);
    await store.save([{ name: 'A', cost: 1, currency: 'USD', category: 'X', renewalDay: 1, addedAt: 'a' }]);
    await store.save([{ name: 'B', cost: 2, currency: 'USD', category: 'X', renewalDay: 2, addedAt: 'b' }]);
    const loaded = await store.load();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].name, 'B');
  } finally {
    await cleanup();
  }
});
