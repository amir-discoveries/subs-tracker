import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type Subscription = {
  name: string;
  cost: number;
  currency: string;
  category: string;
  renewalDay: number;
  addedAt?: string;
};

function resolvePath(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.SUBS_DATA_PATH) return process.env.SUBS_DATA_PATH;
  return join(homedir(), '.subs', 'data.json');
}

export async function saveSubscriptions(subs: Subscription[], path?: string): Promise<void> {
  const resolved = resolvePath(path);
  await mkdir(dirname(resolved), { recursive: true });
  const tmp = `${resolved}.tmp`;
  const payload = JSON.stringify({ version: 1, subscriptions: subs }, null, 2);
  await writeFile(tmp, payload, 'utf8');
  await rename(tmp, resolved);
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

export type UpcomingItem = {
  name: string;
  date: string;
  daysUntil: number;
  cost: number;
  currency: string;
};

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function nextRenewal(renewalDay: number, today: Date): Date {
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();
  const thisMonthClamped = Math.min(renewalDay, daysInMonth(year, month));
  if (todayDay <= thisMonthClamped) {
    return new Date(year, month, thisMonthClamped);
  }
  const rawNextMonth = month + 1;
  const nextYear = year + Math.floor(rawNextMonth / 12);
  const nextMonth = rawNextMonth % 12;
  const nextClamped = Math.min(renewalDay, daysInMonth(nextYear, nextMonth));
  return new Date(nextYear, nextMonth, nextClamped);
}

function daysUntil(date: Date, today: Date): number {
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startTarget.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getUpcoming(subs: Subscription[], now: Date = new Date()): UpcomingItem[] {
  return subs
    .map((sub) => {
      const date = nextRenewal(sub.renewalDay, now);
      return {
        name: sub.name,
        date: formatDate(date),
        daysUntil: daysUntil(date, now),
        cost: sub.cost,
        currency: sub.currency,
      };
    })
    .filter((x) => x.daysUntil >= 0 && x.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
