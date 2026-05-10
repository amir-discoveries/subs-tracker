# subs Web Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Next.js dashboard at `localhost:3000` that visualizes the subscription data already managed by the `subs` CLI, reading directly from `~/.subs/data.json` server-side.

**Architecture:** A new `web/` subfolder at the repo root holds an independent Next.js 15 App Router project (TypeScript, Tailwind v4, shadcn/ui, Recharts). The existing CLI in `src/`/`bin/` is untouched. The two share data only via the JSON file at runtime — no code crosses the boundary. Server components in the dashboard load and compute everything; chart components are thin client wrappers around Recharts.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui (`card` only), Recharts, Vitest.

---

## Environment Note

`node` and `npm` are NOT on PATH on this machine. **Every Bash command in this plan that runs node/npm/npx must be prefixed with:**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && <command>
```

This activates Node v24.15.0 via fnm. Each Bash call is its own shell, so the eval must be repeated every time.

---

## File Structure

```
superpowers/
├── src/, bin/, test/            # existing CLI — DO NOT MODIFY
├── docs/superpowers/...         # specs/plans
└── web/                         # NEW — Next.js app, separate package.json
    ├── app/
    │   ├── page.tsx             # dashboard page (server component)
    │   ├── layout.tsx           # root layout (from create-next-app, edited title)
    │   └── globals.css          # tailwind imports (from create-next-app)
    ├── components/
    │   ├── ui/card.tsx          # shadcn (auto-generated)
    │   ├── totals-cards.tsx     # server — pair of Total Monthly/Yearly cards
    │   ├── category-pie.tsx     # client — Recharts pie
    │   ├── cost-bar.tsx         # client — Recharts horizontal bar
    │   └── upcoming-list.tsx    # server — upcoming-week list
    ├── lib/
    │   ├── data.ts              # types + loadSubscriptions/groupByCurrency/getUpcoming
    │   └── data.test.ts         # Vitest tests (only tested module)
    ├── public/                  # from create-next-app (leave default)
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs       # from create-next-app
    ├── components.json          # shadcn config
    └── vitest.config.ts         # NEW
```

**Each file's responsibility:**

- `lib/data.ts` — pure data loading/transformation. No React. The only file with tests in v1.
- `app/page.tsx` — composes the dashboard from server-loaded data; sets `dynamic = 'force-dynamic'`.
- `components/totals-cards.tsx` & `upcoming-list.tsx` — server components, pure rendering.
- `components/category-pie.tsx` & `cost-bar.tsx` — `'use client'`, wrap Recharts (which needs the browser DOM).

---

## Task 1: Scaffold the Next.js app in `web/`

**Files:**
- Create: `web/` (entire scaffold via `create-next-app`)

- [ ] **Step 1: Confirm we're at the repo root**

Run: `pwd && ls`
Expected: prints `/Users/amiribrahim/Projects/superpowers` and lists `bin docs package.json src test`. There must NOT be an existing `web/` directory.

- [ ] **Step 2: Scaffold via create-next-app (non-interactive)**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && npx --yes create-next-app@latest web --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --turbopack --use-npm
```

Expected: prints "Success! Created web at ..." and exits 0. Takes 30-90s. If it prompts despite the flags, accept the suggested default for any remaining question. It detects the parent git repo and skips creating a nested `.git`.

- [ ] **Step 3: Verify the scaffold and that no nested .git was created**

Run: `ls web/ && ls -a web/ | grep -c '^\.git$' || true`
Expected: `web/` lists `app components.json? next.config.ts node_modules package.json postcss.config.mjs public README.md tsconfig.json` (`components.json` will appear after Task 3). The grep should output `0` (no nested `.git`). If a nested `web/.git` exists, delete it: `rm -rf web/.git`.

- [ ] **Step 4: Verify the dev server starts**

Run (in background, 8s warmup):
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm run dev
```
(Run with `run_in_background: true`.)

Then: `curl -sf http://localhost:3000 -o /dev/null && echo OK`
Expected: prints `OK`. Stop the background dev server afterward.

- [ ] **Step 5: Add `web/node_modules` and `web/.next` to repo .gitignore**

Read `.gitignore` first; current contents are:
```
node_modules/
*.log
.DS_Store
```

Because the existing `node_modules/` rule is unanchored, it already matches `web/node_modules/`. We only need to add `.next/` and `next-env.d.ts` (which create-next-app puts inside `web/`). Edit `.gitignore` to:

```
node_modules/
*.log
.DS_Store
.next/
next-env.d.ts
```

- [ ] **Step 6: Commit the scaffold**

```bash
git add web .gitignore
git commit -m "feat(web): scaffold Next.js 15 dashboard app

Initial create-next-app scaffold with TypeScript, Tailwind v4,
App Router, ESLint, and Turbopack. No app code yet.
"
```

---

## Task 2: Install Recharts + Vitest, configure Vitest

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm install recharts && npm install -D vitest
```
Expected: both installs exit 0. `recharts` lands in `dependencies`; `vitest` in `devDependencies`.

- [ ] **Step 2: Create the Vitest config**

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add the `test` script to `web/package.json`**

Edit `web/package.json` so the `scripts` block contains a `test` entry:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build --turbopack",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
}
```

(Keep whatever `dev`/`build`/`start`/`lint` lines `create-next-app` actually generated; only add `"test": "vitest run"`.)

- [ ] **Step 4: Verify Vitest runs (with no tests yet)**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```
Expected: Vitest reports "No test files found" and exits non-zero. That is the expected state — Vitest is wired up; we'll add tests in Task 3.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts
git commit -m "chore(web): add recharts and vitest"
```

---

## Task 3: Initialize shadcn/ui and add the `card` component

**Files:**
- Create: `web/components.json`, `web/components/ui/card.tsx`, plus shadcn util/CSS edits

- [ ] **Step 1: Run `shadcn init`**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npx --yes shadcn@latest init --yes --defaults --base-color neutral
```

Expected: writes `components.json`, edits `app/globals.css`, creates `lib/utils.ts`, installs `clsx`/`tailwind-merge`/`lucide-react`/`tw-animate-css` etc. Exits 0. If the `--defaults` flag is rejected by your shadcn version, drop it and accept the prompted defaults: Style "new-york", Base color "Neutral", CSS variables "Yes".

- [ ] **Step 2: Add the `card` component**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npx --yes shadcn@latest add card
```

Expected: creates `web/components/ui/card.tsx` with `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` exports.

- [ ] **Step 3: Verify the card file exists and the project still type-checks**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && ls components/ui/card.tsx && npx tsc --noEmit
```
Expected: `components/ui/card.tsx` listed; `tsc` exits 0 with no output.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat(web): init shadcn/ui and add card component"
```

---

## Task 4: TDD `lib/data.ts` — types + `loadSubscriptions`

**Files:**
- Create: `web/lib/data.ts`
- Create: `web/lib/data.test.ts`

- [ ] **Step 1: Write the failing tests for `loadSubscriptions`**

Create `web/lib/data.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```
Expected: FAIL — "Cannot find module './data'" (or similar). All 6 tests reported failing/erroring.

- [ ] **Step 3: Implement `lib/data.ts` with the types and `loadSubscriptions`**

Create `web/lib/data.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add web/lib/data.ts web/lib/data.test.ts
git commit -m "feat(web): add Subscription type and loadSubscriptions

Reads ~/.subs/data.json by default; honors SUBS_DATA_PATH env var
and explicit path arg. Mirrors CLI store validation: missing file
returns []; invalid JSON or wrong shape throws.
"
```

---

## Task 5: TDD `groupByCurrency`

**Files:**
- Modify: `web/lib/data.ts`
- Modify: `web/lib/data.test.ts`

- [ ] **Step 1: Append failing tests for `groupByCurrency`**

Append to the bottom of `web/lib/data.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify the new tests fail**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```
Expected: previous 6 tests still pass; new 5 tests fail with "groupByCurrency is not a function" or import error.

- [ ] **Step 3: Implement `groupByCurrency`**

Append to `web/lib/data.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify pass**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```
Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/lib/data.ts web/lib/data.test.ts
git commit -m "feat(web): add groupByCurrency

Splits subs by currency, sums per-category, sorts buckets and inner
arrays desc by monthly cost.
"
```

---

## Task 6: TDD `getUpcoming`

**Files:**
- Modify: `web/lib/data.ts`
- Modify: `web/lib/data.test.ts`

- [ ] **Step 1: Append failing tests for `getUpcoming`**

Append to `web/lib/data.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify the new tests fail**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```
Expected: previous 11 pass; new 7 fail with "getUpcoming is not a function" or import error.

- [ ] **Step 3: Implement `getUpcoming` (and supporting date helpers)**

Append to `web/lib/data.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify pass**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```
Expected: all 18 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/lib/data.ts web/lib/data.test.ts
git commit -m "feat(web): add getUpcoming for next-7-day renewals

Ports nextRenewal/daysUntil/formatDate from src/dates.js into TS,
filters and sorts to match the CLI's 'upcoming' command behavior.
"
```

---

## Task 7: Build the dashboard page and components

This task is UI assembly — no TDD because the data layer is already covered. Verify visually in Task 8.

**Files:**
- Modify: `web/app/page.tsx`
- Modify: `web/app/layout.tsx` (title only)
- Create: `web/components/totals-cards.tsx`
- Create: `web/components/category-pie.tsx`
- Create: `web/components/cost-bar.tsx`
- Create: `web/components/upcoming-list.tsx`

- [ ] **Step 1: Update the page title**

Edit `web/app/layout.tsx` — find the `metadata` object (created by `create-next-app`) and replace its title and description:

```ts
export const metadata: Metadata = {
  title: "subs",
  description: "Subscription dashboard",
};
```

Leave the rest of `layout.tsx` (font setup, `<html>`, `<body>` etc.) as scaffolded.

- [ ] **Step 2: Create `components/totals-cards.tsx`**

Create `web/components/totals-cards.tsx`:

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = {
  currency: string;
  totalMonthly: number;
  totalYearly: number;
};

function fmt(n: number) {
  return n.toFixed(2);
}

export function TotalsCards({ currency, totalMonthly, totalYearly }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground font-medium">
            Total Monthly
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tabular-nums">
            {fmt(totalMonthly)} <span className="text-2xl text-muted-foreground">{currency}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground font-medium">
            Total Yearly
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tabular-nums">
            {fmt(totalYearly)} <span className="text-2xl text-muted-foreground">{currency}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/category-pie.tsx`**

Create `web/components/category-pie.tsx`:

```tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = {
  data: { category: string; monthly: number }[];
  currency: string;
};

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#9333ea", "#0891b2", "#65a30d", "#db2777"];

export function CategoryPie({ data, currency }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>By Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="monthly"
                nameKey="category"
                outerRadius="80%"
                label
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(2)} ${currency}/mo`}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `components/cost-bar.tsx`**

Create `web/components/cost-bar.tsx`:

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = {
  data: { name: string; monthly: number }[];
  currency: string;
};

export function CostBar({ data, currency }: Props) {
  const height = Math.max(200, data.length * 36 + 40);
  return (
    <Card>
      <CardHeader>
        <CardTitle>By Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => Number(v).toFixed(0)} />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)} ${currency}/mo`} />
              <Bar dataKey="monthly" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create `components/upcoming-list.tsx`**

Create `web/components/upcoming-list.tsx`:

```tsx
import type { UpcomingItem } from "@/lib/data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = { items: UpcomingItem[] };

function whenPhrase(n: number) {
  if (n === 0) return "today";
  if (n === 1) return "in 1 day";
  return `in ${n} days`;
}

export function UpcomingList({ items }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming this week</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No renewals in the next 7 days.</p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={`${it.name}-${it.date}`} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {it.date} ({whenPhrase(it.daysUntil)})
                  </div>
                </div>
                <div className="tabular-nums text-sm">
                  {it.cost.toFixed(2)} {it.currency}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Replace `app/page.tsx`**

Overwrite `web/app/page.tsx` (it currently contains the `create-next-app` placeholder):

```tsx
import { loadSubscriptions, groupByCurrency, getUpcoming } from "@/lib/data";
import { TotalsCards } from "@/components/totals-cards";
import { CategoryPie } from "@/components/category-pie";
import { CostBar } from "@/components/cost-bar";
import { UpcomingList } from "@/components/upcoming-list";

export const dynamic = "force-dynamic";

export default async function Page() {
  const subs = await loadSubscriptions();

  if (subs.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-center text-muted-foreground">
          No subscriptions yet — run <code className="font-mono">subs add</code> to add one.
        </p>
      </main>
    );
  }

  const buckets = groupByCurrency(subs);
  const upcoming = getUpcoming(subs);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-12">
        <h1 className="text-2xl font-semibold tracking-tight">subs</h1>
        {buckets.map((b) => (
          <section key={b.currency} className="space-y-6">
            {buckets.length > 1 && (
              <h2 className="text-lg font-medium text-muted-foreground">{b.currency}</h2>
            )}
            <TotalsCards
              currency={b.currency}
              totalMonthly={b.totalMonthly}
              totalYearly={b.totalYearly}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryPie data={b.byCategory} currency={b.currency} />
              <CostBar data={b.bySubscription} currency={b.currency} />
            </div>
          </section>
        ))}
        <UpcomingList items={upcoming} />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify the project type-checks**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npx tsc --noEmit
```
Expected: exits 0 with no output.

- [ ] **Step 8: Commit**

```bash
git add web/app web/components
git commit -m "feat(web): build dashboard page and chart components

Server page composes per-currency sections (totals cards, category
pie, cost bar) plus a unified upcoming-this-week list. Charts are
client components; everything else is server-rendered.
"
```

---

## Task 8: Manual verification with fixture data

This is the last task. The earlier tests cover the data layer; this task verifies the page actually renders end-to-end.

**Files:**
- None modified (this task uses a tmp fixture)

- [ ] **Step 1: Create a tmp fixture data file**

Run:
```bash
mkdir -p /tmp/subs-fixture && cat > /tmp/subs-fixture/data.json <<'EOF'
{
  "version": 1,
  "subscriptions": [
    { "name": "Netflix",  "cost": 15.99, "currency": "USD", "category": "entertainment", "renewalDay": 5 },
    { "name": "Spotify",  "cost": 9.99,  "currency": "USD", "category": "music",         "renewalDay": 12 },
    { "name": "Hulu",     "cost": 7.99,  "currency": "USD", "category": "entertainment", "renewalDay": 18 },
    { "name": "iCloud",   "cost": 2.99,  "currency": "USD", "category": "storage",       "renewalDay": 1  },
    { "name": "Spiegel",  "cost": 5.00,  "currency": "EUR", "category": "news",          "renewalDay": 14 }
  ]
}
EOF
```

- [ ] **Step 2: Start the dev server pointing at the fixture**

Run (background):
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && SUBS_DATA_PATH=/tmp/subs-fixture/data.json npm run dev
```
(Run with `run_in_background: true`, then give it ~8s to warm up.)

- [ ] **Step 3: Smoke-test that the page returns HTML containing expected content**

Run:
```bash
curl -sf http://localhost:3000 | grep -E "Total Monthly|Netflix|Upcoming" | head -5
```
Expected: prints lines that include "Total Monthly", "Netflix", "Upcoming this week" — confirming the page rendered with fixture data. If any of those strings are missing, inspect the dev server output for errors before proceeding.

- [ ] **Step 4: Open in a browser and visually verify**

Open `http://localhost:3000` in a browser. Confirm:
- Two big cards at the top showing **34.96 USD** monthly / **419.52 USD** yearly (the USD bucket)
- A pie chart with categories: entertainment, music, storage
- A horizontal bar chart with Netflix, Spotify, Hulu, iCloud sorted desc
- A second EUR section below with **5.00 EUR** / **60.00 EUR** and its own pie/bar
- An "Upcoming this week" card at the bottom (contents depend on today's date)

If anything is wrong, fix and re-verify before committing.

- [ ] **Step 5: Verify the empty-state path**

Stop the dev server. Restart pointing at a non-existent file:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && SUBS_DATA_PATH=/tmp/subs-fixture/does-not-exist.json npm run dev
```
(Background, ~8s warmup.)

Then: `curl -sf http://localhost:3000 | grep -F "No subscriptions yet"`
Expected: prints the empty-state line. Stop the server.

- [ ] **Step 6: Run the full test suite once more**

Run:
```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```
Expected: all 18 tests pass.

- [ ] **Step 7: Clean up the fixture**

Run: `rm -rf /tmp/subs-fixture`

- [ ] **Step 8: No commit needed**

This task only verified existing committed code. Nothing to commit. The dashboard is complete.

---

## Done

`web/` is a self-contained Next.js dashboard sitting beside the unchanged CLI. Run `cd web && npm run dev` to view it at `localhost:3000` against the user's real `~/.subs/data.json`.
