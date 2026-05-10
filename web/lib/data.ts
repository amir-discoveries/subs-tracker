import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Subscription = {
  name: string;
  cost: number;
  currency: string;
  category: string;
  renewalDay: number;
};

function resolvePath(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.SUBS_DATA_PATH) return process.env.SUBS_DATA_PATH;
  return join(homedir(), '.subs', 'data.json');
}

export async function loadSubscriptions(path?: string): Promise<Subscription[]> {
  const resolved = resolvePath(path);
  let raw: string;
  try {
    raw = await readFile(resolved, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${resolved} is not valid JSON`);
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { subscriptions?: unknown }).subscriptions)
  ) {
    throw new Error(`${resolved} has unexpected shape (missing subscriptions array)`);
  }
  return (parsed as { subscriptions: Subscription[] }).subscriptions;
}

export type CurrencyBucket = {
  currency: string;
  totalMonthly: number;
  totalYearly: number;
  byCategory: { category: string; monthly: number }[];
  bySubscription: { name: string; monthly: number }[];
};

export function groupByCurrency(subs: Subscription[]): CurrencyBucket[] {
  const byCur = new Map<
    string,
    { totalMonthly: number; cats: Map<string, number>; subs: { name: string; monthly: number }[] }
  >();
  for (const s of subs) {
    let bucket = byCur.get(s.currency);
    if (!bucket) {
      bucket = { totalMonthly: 0, cats: new Map(), subs: [] };
      byCur.set(s.currency, bucket);
    }
    bucket.totalMonthly += s.cost;
    bucket.cats.set(s.category, (bucket.cats.get(s.category) ?? 0) + s.cost);
    bucket.subs.push({ name: s.name, monthly: s.cost });
  }
  const result: CurrencyBucket[] = [];
  for (const [currency, bucket] of byCur) {
    const byCategory = [...bucket.cats.entries()]
      .map(([category, monthly]) => ({ category, monthly }))
      .sort((a, b) => b.monthly - a.monthly);
    const bySubscription = [...bucket.subs].sort((a, b) => b.monthly - a.monthly);
    result.push({
      currency,
      totalMonthly: bucket.totalMonthly,
      totalYearly: bucket.totalMonthly * 12,
      byCategory,
      bySubscription,
    });
  }
  result.sort((a, b) => b.totalMonthly - a.totalMonthly);
  return result;
}
