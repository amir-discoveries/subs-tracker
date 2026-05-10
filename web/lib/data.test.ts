import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSubscriptions } from './data';

describe('loadSubscriptions', () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'subs-web-test-'));
    path = join(dir, 'data.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.SUBS_DATA_PATH;
  });

  it('returns [] when the file is missing', async () => {
    const result = await loadSubscriptions(path);
    expect(result).toEqual([]);
  });

  it('returns the subscriptions array from a valid file', async () => {
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        subscriptions: [
          { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'entertainment', renewalDay: 5 },
        ],
      }),
    );
    const result = await loadSubscriptions(path);
    expect(result).toEqual([
      { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'entertainment', renewalDay: 5 },
    ]);
  });

  it('throws on invalid JSON', async () => {
    await writeFile(path, '{not json');
    await expect(loadSubscriptions(path)).rejects.toThrow();
  });

  it('throws when the root has no subscriptions array', async () => {
    await writeFile(path, JSON.stringify({ version: 1 }));
    await expect(loadSubscriptions(path)).rejects.toThrow(/subscriptions/);
  });

  it('uses SUBS_DATA_PATH env var when no path arg is given', async () => {
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        subscriptions: [
          { name: 'Spotify', cost: 9.99, currency: 'USD', category: 'music', renewalDay: 12 },
        ],
      }),
    );
    process.env.SUBS_DATA_PATH = path;
    const result = await loadSubscriptions();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Spotify');
  });

  it('the explicit path arg overrides SUBS_DATA_PATH', async () => {
    const otherPath = join(dir, 'other.json');
    await writeFile(
      otherPath,
      JSON.stringify({ version: 1, subscriptions: [{ name: 'A', cost: 1, currency: 'USD', category: 'x', renewalDay: 1 }] }),
    );
    process.env.SUBS_DATA_PATH = path; // points at non-existent file
    const result = await loadSubscriptions(otherPath);
    expect(result).toEqual([{ name: 'A', cost: 1, currency: 'USD', category: 'x', renewalDay: 1 }]);
  });
});
