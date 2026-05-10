# subs Web Dashboard

## Overview

A read-only Next.js dashboard that visualizes the same `~/.subs/data.json` file that the existing `subs` CLI uses. Reads happen server-side via the filesystem. No API, no client-side fetching, no write path in v1.

The dashboard lives in a new `web/` directory at the root of the repo, with its own `package.json`. The CLI package is left untouched. The two share data only via the JSON file at runtime — no code is imported across the boundary.

## Layout

```
superpowers/
├── src/, bin/, test/        # existing CLI, untouched
└── web/                     # new Next.js app, separate package.json
    ├── app/
    │   ├── page.tsx         # the single dashboard page (server component)
    │   ├── layout.tsx
    │   └── globals.css
    ├── components/
    │   ├── ui/card.tsx      # shadcn
    │   ├── totals-cards.tsx
    │   ├── category-pie.tsx
    │   ├── cost-bar.tsx
    │   └── upcoming-list.tsx
    ├── lib/
    │   ├── data.ts          # load + compute (the tested module)
    │   └── data.test.ts
    ├── public/
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.ts
    ├── components.json      # shadcn config
    └── vitest.config.ts
```

## Toolchain

- **Next.js 15** (App Router), **TypeScript**, **Tailwind v4** — scaffolded via `create-next-app`
- **shadcn/ui** — only the `card` component installed for v1
- **Recharts** — pie + bar charts
- **Vitest** — for the data-layer tests (the CLI keeps using `node --test`; the two test stacks don't interact)
- Dev server: `npm run dev` from `web/` → `localhost:3000`

## Data layer (`lib/data.ts`)

Pure functions, no React, no Next-specifics, fully unit-testable.

### Types

```ts
type Subscription = {
  name: string;
  cost: number;       // monthly
  currency: string;
  category: string;
  renewalDay: number; // 1-31
};

type CurrencyBucket = {
  currency: string;
  totalMonthly: number;
  totalYearly: number;                                  // totalMonthly * 12
  byCategory: { category: string; monthly: number }[];  // sorted desc by monthly
  bySubscription: { name: string; monthly: number }[];  // sorted desc by monthly
};

type UpcomingItem = {
  name: string;
  date: string;        // YYYY-MM-DD
  daysUntil: number;   // 0-7
  cost: number;
  currency: string;
};
```

### Functions

```ts
loadSubscriptions(path?: string): Promise<Subscription[]>
groupByCurrency(subs: Subscription[]): CurrencyBucket[]    // sorted by totalMonthly desc
getUpcoming(subs: Subscription[], now?: Date): UpcomingItem[]  // sorted by date asc
```

### Behavior

- **Path resolution**: `path` argument > `process.env.SUBS_DATA_PATH` > `~/.subs/data.json`. The env var is essential for tests pointing at fixture files.
- **Loading mirrors the CLI's validation** ([src/store.js](../../../src/store.js)):
  - Missing file (`ENOENT`) → returns `[]`
  - Invalid JSON → throws
  - File exists but root has no `subscriptions` array → throws
- **`groupByCurrency`**: walks subs once, accumulates per currency, sorts each bucket's `byCategory` and `bySubscription` arrays by monthly desc, then sorts buckets by `totalMonthly` desc.
- **`getUpcoming`**: ports the date math from [src/dates.js](../../../src/dates.js) (`nextRenewal`, `daysUntil`, `formatDate`) into TypeScript. Filters to `daysUntil` in `[0, 7]`. End-of-month clamping must match the CLI (e.g. `renewalDay: 31` in February → Feb 28/29).

## Page (`app/page.tsx`)

Server component. Top of file:

```ts
export const dynamic = 'force-dynamic';
```

This forces re-reading the data file on every request, so a browser refresh always shows current data without needing a watcher or revalidation tag.

### Data flow

```
page.tsx (server)
  └─ loadSubscriptions()
      ├─ groupByCurrency()  → buckets passed to chart sections
      └─ getUpcoming()       → list passed to UpcomingList
```

### Empty state

If `loadSubscriptions()` returns `[]` (file missing or no subs yet), the page renders a single centered message: "No subscriptions yet — run `subs add` to add one." No charts, no empty-state cards.

### Layout (vertical stack, centered, max-width container)

For each currency bucket (repeats per currency, ordered by `totalMonthly` desc):

1. **Totals row** — two large `Card`s side-by-side: "Total Monthly" and "Total Yearly", each showing the amount + currency code.
2. **Category pie** — Recharts `PieChart` of `byCategory`, slice labels = category, tooltip shows monthly amount.
3. **Cost bar** — Recharts horizontal `BarChart` of `bySubscription`, subscription names on the Y axis, monthly cost on X, sorted desc (largest at top).

Below all per-currency sections:

4. **Upcoming this week** — single list across all currencies, each row: name, date, "in N days" (or "today"), cost + currency. If the list is empty, render "No renewals in the next 7 days."

### Client/server boundary

- `app/page.tsx`, `totals-cards.tsx`, `upcoming-list.tsx`: server components (pure rendering of server-computed data)
- `category-pie.tsx`, `cost-bar.tsx`: `'use client'` — Recharts requires a browser DOM. Data is passed in as props from the server component, so no client-side fetching.

## Tests (`lib/data.test.ts`)

Vitest. Each test writes a fixture JSON to a tmpdir, sets `SUBS_DATA_PATH` to point at it, and exercises the function. No mocking.

### `loadSubscriptions`

- Missing file → returns `[]`
- Valid file → returns the `subscriptions` array
- Invalid JSON → throws
- Root with no `subscriptions` array → throws
- Explicit `path` argument overrides env var

### `groupByCurrency`

- Single-currency input: one bucket, correct totals, correct yearly = monthly × 12
- Multi-currency input: one bucket per currency, buckets sorted by total desc
- Categories summed correctly within a bucket; ties allowed
- `byCategory` and `bySubscription` sorted desc by monthly

### `getUpcoming`

- Renewal today (day 0) included
- Renewal in 7 days included
- Renewal in 8 days excluded
- End-of-month clamping: `renewalDay: 31` checked in February returns Feb 28 (or 29 in leap years)
- Cross-month/cross-year boundaries handled
- Output sorted by `daysUntil` asc

## Out of scope for v1

The following are deliberately deferred:

- API routes / route handlers
- Client-side data fetching, polling, or live reload
- Authentication
- Any write path (add/edit/remove subscriptions from the web UI)
- Configurable upcoming-window (always 7 days)
- Theme toggle / dark mode switcher
- Component-level UI tests (the data layer is fully covered; chart components are thin wrappers)
- Currency conversion or unified totals across currencies
