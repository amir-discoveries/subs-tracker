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

import { groupByCurrency } from './data';

describe('groupByCurrency', () => {
  it('returns one bucket per currency with correct totals', () => {
    const subs = [
      { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'entertainment', renewalDay: 5 },
      { name: 'Spotify', cost: 9.99, currency: 'USD', category: 'music', renewalDay: 12 },
      { name: 'Spiegel', cost: 5, currency: 'EUR', category: 'news', renewalDay: 1 },
    ];
    const buckets = groupByCurrency(subs);
    expect(buckets).toHaveLength(2);
    const usd = buckets.find((b) => b.currency === 'USD')!;
    const eur = buckets.find((b) => b.currency === 'EUR')!;
    expect(usd.totalMonthly).toBeCloseTo(25.98, 2);
    expect(usd.totalYearly).toBeCloseTo(25.98 * 12, 2);
    expect(eur.totalMonthly).toBe(5);
    expect(eur.totalYearly).toBe(60);
  });

  it('sorts buckets by totalMonthly desc', () => {
    const subs = [
      { name: 'Small', cost: 1, currency: 'EUR', category: 'x', renewalDay: 1 },
      { name: 'Big', cost: 100, currency: 'USD', category: 'x', renewalDay: 1 },
    ];
    const buckets = groupByCurrency(subs);
    expect(buckets.map((b) => b.currency)).toEqual(['USD', 'EUR']);
  });

  it('sums categories within a bucket', () => {
    const subs = [
      { name: 'Netflix', cost: 15, currency: 'USD', category: 'entertainment', renewalDay: 5 },
      { name: 'Hulu', cost: 10, currency: 'USD', category: 'entertainment', renewalDay: 8 },
      { name: 'Spotify', cost: 9, currency: 'USD', category: 'music', renewalDay: 12 },
    ];
    const [usd] = groupByCurrency(subs);
    expect(usd.byCategory).toEqual([
      { category: 'entertainment', monthly: 25 },
      { category: 'music', monthly: 9 },
    ]);
  });

  it('sorts byCategory and bySubscription desc by monthly', () => {
    const subs = [
      { name: 'Cheap', cost: 1, currency: 'USD', category: 'a', renewalDay: 1 },
      { name: 'Mid', cost: 10, currency: 'USD', category: 'b', renewalDay: 1 },
      { name: 'Pricey', cost: 100, currency: 'USD', category: 'c', renewalDay: 1 },
    ];
    const [usd] = groupByCurrency(subs);
    expect(usd.bySubscription).toEqual([
      { name: 'Pricey', monthly: 100 },
      { name: 'Mid', monthly: 10 },
      { name: 'Cheap', monthly: 1 },
    ]);
    expect(usd.byCategory.map((c) => c.category)).toEqual(['c', 'b', 'a']);
  });

  it('returns [] for empty input', () => {
    expect(groupByCurrency([])).toEqual([]);
  });
});
