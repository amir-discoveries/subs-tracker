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

import { getUpcoming } from './data';

describe('getUpcoming', () => {
  it('includes a renewal due today (daysUntil 0)', () => {
    const today = new Date(2026, 4, 10); // 2026-05-10
    const subs = [{ name: 'A', cost: 5, currency: 'USD', category: 'x', renewalDay: 10 }];
    const result = getUpcoming(subs, today);
    expect(result).toEqual([
      { name: 'A', date: '2026-05-10', daysUntil: 0, cost: 5, currency: 'USD' },
    ]);
  });

  it('includes a renewal exactly 7 days away', () => {
    const today = new Date(2026, 4, 10);
    const subs = [{ name: 'B', cost: 5, currency: 'USD', category: 'x', renewalDay: 17 }];
    const result = getUpcoming(subs, today);
    expect(result).toHaveLength(1);
    expect(result[0].daysUntil).toBe(7);
  });

  it('excludes a renewal 8 days away', () => {
    const today = new Date(2026, 4, 10);
    const subs = [{ name: 'C', cost: 5, currency: 'USD', category: 'x', renewalDay: 18 }];
    const result = getUpcoming(subs, today);
    expect(result).toEqual([]);
  });

  it('clamps renewalDay 31 to last day of February', () => {
    const today = new Date(2026, 1, 25); // 2026-02-25 (non-leap)
    const subs = [{ name: 'D', cost: 5, currency: 'USD', category: 'x', renewalDay: 31 }];
    const result = getUpcoming(subs, today);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-02-28');
    expect(result[0].daysUntil).toBe(3);
  });

  it('rolls into next month when today is past this-month renewal', () => {
    const today = new Date(2026, 4, 28); // 2026-05-28
    const subs = [{ name: 'E', cost: 5, currency: 'USD', category: 'x', renewalDay: 1 }];
    const result = getUpcoming(subs, today);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-06-01');
    expect(result[0].daysUntil).toBe(4);
  });

  it('sorts by daysUntil asc', () => {
    const today = new Date(2026, 4, 10);
    const subs = [
      { name: 'In5', cost: 5, currency: 'USD', category: 'x', renewalDay: 15 },
      { name: 'Today', cost: 5, currency: 'USD', category: 'x', renewalDay: 10 },
      { name: 'In3', cost: 5, currency: 'USD', category: 'x', renewalDay: 13 },
    ];
    const result = getUpcoming(subs, today);
    expect(result.map((r) => r.name)).toEqual(['Today', 'In3', 'In5']);
  });

  it('returns [] when nothing is in the next 7 days', () => {
    const today = new Date(2026, 4, 10);
    const subs = [{ name: 'Far', cost: 5, currency: 'USD', category: 'x', renewalDay: 25 }];
    expect(getUpcoming(subs, today)).toEqual([]);
  });
});

import { saveSubscriptions } from './data';
import { readFile, readdir, writeFile as writeFileFn } from 'node:fs/promises';

describe('saveSubscriptions', () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'subs-save-test-'));
    path = join(dir, 'data.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.SUBS_DATA_PATH;
  });

  it('writes a file with version 1 and the subscriptions array', async () => {
    const subs = [
      { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'entertainment', renewalDay: 5 },
    ];
    await saveSubscriptions(subs, path);
    const raw = await readFile(path, 'utf8');
    expect(JSON.parse(raw)).toEqual({ version: 1, subscriptions: subs });
  });

  it('round-trips with loadSubscriptions', async () => {
    const subs = [
      { name: 'A', cost: 1, currency: 'USD', category: 'x', renewalDay: 1 },
      { name: 'B', cost: 2, currency: 'EUR', category: 'y', renewalDay: 15 },
    ];
    await saveSubscriptions(subs, path);
    const loaded = await loadSubscriptions(path);
    expect(loaded).toEqual(subs);
  });

  it('creates the parent directory if it does not exist', async () => {
    const nested = join(dir, 'nested', 'deeper', 'data.json');
    await saveSubscriptions([], nested);
    const raw = await readFile(nested, 'utf8');
    expect(JSON.parse(raw)).toEqual({ version: 1, subscriptions: [] });
  });

  it('leaves no .tmp file behind after a successful save', async () => {
    await saveSubscriptions(
      [{ name: 'A', cost: 1, currency: 'USD', category: 'x', renewalDay: 1 }],
      path,
    );
    const entries = await readdir(dir);
    expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
  });

  it('honors SUBS_DATA_PATH when no explicit path is given', async () => {
    process.env.SUBS_DATA_PATH = path;
    await saveSubscriptions([{ name: 'A', cost: 1, currency: 'USD', category: 'x', renewalDay: 1 }]);
    const raw = await readFile(path, 'utf8');
    expect(JSON.parse(raw).subscriptions).toHaveLength(1);
  });

  it('overwrites an existing file', async () => {
    await writeFileFn(path, '"garbage"', 'utf8');
    await saveSubscriptions(
      [{ name: 'A', cost: 1, currency: 'USD', category: 'x', renewalDay: 1 }],
      path,
    );
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(parsed.subscriptions).toHaveLength(1);
  });
});

import { monthlyCost, yearlyCost } from './data';

describe('monthlyCost / yearlyCost', () => {
  it('treats a sub with no cycle as monthly', () => {
    const sub = { name: 'A', cost: 10, currency: 'USD', category: 'x', renewalDay: 5 };
    expect(monthlyCost(sub)).toBe(10);
    expect(yearlyCost(sub)).toBe(120);
  });

  it('treats cycle="monthly" the same as legacy', () => {
    const sub = { name: 'A', cost: 10, currency: 'USD', category: 'x', renewalDay: 5, cycle: 'monthly' as const };
    expect(monthlyCost(sub)).toBe(10);
    expect(yearlyCost(sub)).toBe(120);
  });

  it('divides by 12 for cycle="yearly" to get monthly', () => {
    const sub = {
      name: 'B',
      cost: 99,
      currency: 'USD',
      category: 'x',
      renewalDay: 15,
      renewalMonth: 12,
      cycle: 'yearly' as const,
    };
    expect(monthlyCost(sub)).toBeCloseTo(8.25, 2);
    expect(yearlyCost(sub)).toBe(99);
  });
});

describe('groupByCurrency with cycle', () => {
  it('normalizes a yearly sub to monthly when summing totalMonthly', () => {
    const subs = [
      { name: 'A', cost: 10, currency: 'USD', category: 'x', renewalDay: 1 },
      { name: 'B', cost: 120, currency: 'USD', category: 'y', renewalDay: 1, renewalMonth: 6, cycle: 'yearly' as const },
    ];
    const [usd] = groupByCurrency(subs);
    expect(usd.totalMonthly).toBeCloseTo(20, 2); // 10 + 120/12
    expect(usd.totalYearly).toBeCloseTo(240, 2); // 20 * 12
  });

  it('uses monthly-equivalent in byCategory and bySubscription', () => {
    const subs = [
      { name: 'YearlySub', cost: 240, currency: 'USD', category: 'cat1', renewalDay: 1, renewalMonth: 1, cycle: 'yearly' as const },
      { name: 'MonthlySub', cost: 5, currency: 'USD', category: 'cat2', renewalDay: 1 },
    ];
    const [usd] = groupByCurrency(subs);
    // YearlySub monthly-equivalent = 240/12 = 20, beats MonthlySub at 5
    expect(usd.bySubscription[0]).toEqual({ name: 'YearlySub', monthly: 20 });
    expect(usd.bySubscription[1]).toEqual({ name: 'MonthlySub', monthly: 5 });
    expect(usd.byCategory).toEqual([
      { category: 'cat1', monthly: 20 },
      { category: 'cat2', monthly: 5 },
    ]);
  });
});
