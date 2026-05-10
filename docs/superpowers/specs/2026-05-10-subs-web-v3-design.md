# subs Web Dashboard v3 — Yearly Subs, Form Polish, Visual Refresh

## Overview

v3 adds three things to the dashboard:

1. **Yearly subscriptions** — a sub can renew once a year (or any cycle of "every year on this month + day"), not just monthly. Stored cost is the per-cycle amount; totals normalize to monthly + yearly.
2. **Friendlier Add form** — `Currency` becomes a 2-option dropdown (USD/EUR), `Category` a 9-option dropdown, and renewal can be entered as a **date** OR **days from today** (the user picks whichever they have on hand). Cycle (Monthly/Yearly) is a toggle at the top of the form.
3. **Warm & calm visual refresh** — cream background, terracotta/sage accent palette, soft shadows, serif accents on headings. Replaces the current minimalist look.

The CLI is no longer the source of truth — yearly subs added via the web won't be correctly summed by `subs total`. This is a deliberate trade-off (single-user web-first app); the CLI keeps working for monthly subs.

## Data Model Changes (`web/lib/data.ts`)

Extend the `Subscription` type:

```ts
export type Cycle = "monthly" | "yearly";

export type Subscription = {
  name: string;
  cost: number;           // per cycle (monthly cost for monthly, yearly cost for yearly)
  currency: string;
  category: string;
  cycle?: Cycle;          // optional; absent = monthly (legacy data)
  renewalDay: number;     // 1-31 (day part)
  renewalMonth?: number;  // 1-12 — REQUIRED when cycle === 'yearly', omitted otherwise
  addedAt?: string;
};
```

**Backward compatibility:** existing data without `cycle` is treated as monthly. The data file's `version` stays at `1` — the new fields are additive optionals.

### Cost normalization helpers

Add to `web/lib/data.ts`:

```ts
export function monthlyCost(sub: Subscription): number {
  return sub.cycle === "yearly" ? sub.cost / 12 : sub.cost;
}

export function yearlyCost(sub: Subscription): number {
  return sub.cycle === "yearly" ? sub.cost : sub.cost * 12;
}
```

### `groupByCurrency` updates

`totalMonthly` / `totalYearly` use the helpers above so a yearly sub costing 99 EUR contributes `99/12 ≈ 8.25` to monthly and `99` to yearly. `byCategory` and `bySubscription` use `monthlyCost(sub)` (consistent comparison units in charts).

### `getUpcoming` updates

Computes the next renewal correctly for both cycles:

- **Monthly** (existing): pick the next occurrence of `renewalDay` (this month or next, with end-of-month clamping). Unchanged.
- **Yearly** (new): pick the next occurrence of `(renewalMonth, renewalDay)` — this year if still upcoming, otherwise next year. Same end-of-month clamping (`renewalDay: 31` in February → Feb 28/29).

Filter is unchanged: `daysUntil` ∈ `[0, 7]`. So yearly subs only appear in "Upcoming this week" when their annual date is within a week.

## Categories

Fixed list, used in the Add dialog dropdown:

1. Entertainment
2. Music
3. Software
4. Cloud / Storage
5. News / Media
6. Productivity
7. Fitness / Health
8. Utilities
9. Other

The CLI may have written other free-text categories. Existing data with non-listed categories renders fine in the table and charts — we just don't offer those values when adding a NEW sub.

## Currencies

Fixed dropdown: `USD`, `EUR`. The Server Action's existing 3-letter regex still applies as a defense-in-depth check. Existing CLI data with other currencies (e.g. `GBP`) renders fine — the dropdown just doesn't include it.

## Add Dialog (form changes)

```
┌─ Add a subscription ──────────────────────┐
│                                           │
│  ( ) Monthly   (•) Yearly      ← cycle    │
│                                           │
│  Name           [____________________]    │
│  Cost / yr      [____]   Currency [USD ▾] │   ← label adapts: "/mo" or "/yr"
│  Category       [Entertainment    ▾]      │
│                                           │
│  Next renewal:                            │
│    (•) On date  [📅 2026-12-15  ]          │
│    ( ) In days  [____] days from today    │
│                                           │
│  [error banner — only after a submit]     │
│                                           │
│                  [Add subscription]       │
└───────────────────────────────────────────┘
```

- **Cycle** is a segmented toggle (Monthly / Yearly). Defaults to Monthly.
- **Cost label** reads "Cost / mo" for monthly, "Cost / yr" for yearly.
- **Renewal input** is a single radio-pair: pick exactly one of two ways to enter the date.
  - Date input: standard HTML `<input type="date">`. Min = today, max = today + 730 days.
  - Days input: `<input type="number" min="0" max="730">`.
- The form serializes whichever input is active. The Server Action computes the final `(renewalDay, renewalMonth)` from whichever value arrived.
- **Currency dropdown** uses shadcn `Select` (new primitive, see below).
- **Category dropdown** likewise.

Validation rules in the Server Action stay close to the current ones, plus:
- `cycle` ∈ `{ "monthly", "yearly" }`.
- One of `renewalDate` (`YYYY-MM-DD`) or `renewalInDays` (integer 0-730) must be present. Both → error. Neither → error.
- The resolved `(month, day)` must produce a date in `[today, today + 730]`.

## SubscriptionsTable

Adds a **Cycle** column between Cost and Currency, showing "Monthly" or "Yearly" as a small label. Cost column shows the per-cycle amount with the suffix `/mo` or `/yr`. Renewal column shows the day for monthly subs, or the date (e.g. "Dec 15") for yearly.

Sorting stays cost-desc, but now uses `monthlyCost(sub)` so a $99/yr sub doesn't outrank a $15/mo sub.

## Visual Refresh — Warm & Calm

Tailwind v4's CSS variables (defined in `web/app/globals.css`) get a new theme. The shadcn-managed primitives (`Card`, `Button`, `Dialog`, etc.) automatically pick up the new tokens.

### Palette

| Token | Light value | Notes |
|---|---|---|
| `--background` | `#fbf7f2` (cream) | page bg |
| `--foreground` | `#1a1410` (deep brown-black) | body text |
| `--card` | `#ffffff` | card bg |
| `--card-foreground` | `#1a1410` | |
| `--muted` | `#f0e6d6` (soft cream) | subtle bg fills |
| `--muted-foreground` | `#9c8b78` (warm grey) | secondary text |
| `--primary` | `#c2410c` (terracotta) | primary buttons, key accents |
| `--primary-foreground` | `#fbf7f2` | text on primary |
| `--secondary` | `#65a30d` (sage) | secondary accents (yearly cycle, "addedAt") |
| `--accent` | `#a16207` (warm gold) | hover states |
| `--destructive` | `#b91c1c` (warm red) | errors |
| `--border` | `#e8dccd` (cream-edge) | borders |
| `--ring` | `#c2410c` | focus rings |
| `--radius` | `0.5rem` | softer than current 0.625 |

### Typography

- Body: `system-ui` (current default — keep).
- **Add a serif heading font** for `<h1>`/`<h2>`/`CardTitle`. Use `Instrument Serif` from Google Fonts (a free, classy serif that pairs well with system sans). Imported via Next's `next/font/google` in `app/layout.tsx`.
- Monospace tabular numbers stay as `font-feature-settings: "tnum"` via Tailwind's `tabular-nums`.

### Chart colors

Recharts gets a new palette consistent with the theme:
- Pie/bar primary: `#c2410c` (terracotta)
- Secondary slices: `#a16207` (gold), `#65a30d` (sage), `#0e7490` (teal), `#7e22ce` (purple), `#be185d` (rose), `#0891b2` (cyan), `#65a30d` (sage)

Replaces the current `#2563eb` blue.

### Spacing & radius

- Cards: `rounded-xl` (current) → kept; bg-card unchanged.
- Buttons: slightly more padding (`px-5 py-2.5` for default), softer hover (use `--accent` not `bg-primary/90`).
- More vertical breathing room between sections (`space-y-12` → `space-y-16` on the page).

### Header treatment

The plain `<h1>subs</h1>` becomes a small two-line header:
```
subs                                  [+ Add subscription]
your subscriptions, calmly tracked
```
Subtitle in the muted-foreground color, italic serif.

## New shadcn primitive

Add `Select` via `npx shadcn@latest add select` so the Category and Currency dropdowns have a polished, accessible widget. (Native `<select>` would also work and is simpler — but the visual refresh is the point of this section, and shadcn `Select` is the obvious match for a polished UI.)

## File Changes Summary

```
web/
├── app/
│   ├── actions.ts                       # MODIFIED — accept cycle + date|days, validate, compute renewalMonth
│   ├── globals.css                      # MODIFIED — new palette tokens (warm/calm)
│   ├── layout.tsx                       # MODIFIED — load Instrument Serif via next/font/google, set up CSS variable for the heading font
│   └── page.tsx                         # MODIFIED — header subtitle, padding tweaks
├── components/
│   ├── add-subscription-dialog.tsx      # MODIFIED — cycle toggle, date/days radio, dropdowns
│   ├── subscriptions-table.tsx          # MODIFIED — Cycle column, /mo or /yr suffix, formatted renewal cell
│   ├── totals-cards.tsx                 # MODIFIED — small visual polish (serif title)
│   ├── category-pie.tsx                 # MODIFIED — new chart palette
│   ├── cost-bar.tsx                     # MODIFIED — new chart palette
│   ├── upcoming-list.tsx                # MODIFIED — yearly-aware renewal label ("Dec 15")
│   └── ui/select.tsx                    # NEW — shadcn primitive
└── lib/
    ├── data.ts                          # MODIFIED — Subscription type, monthlyCost/yearlyCost helpers, getUpcoming yearly branch, groupByCurrency normalization
    └── data.test.ts                     # MODIFIED — tests for new behavior
```

## Tests

Append to `web/lib/data.test.ts`:

- `monthlyCost` / `yearlyCost` for both cycles (with default monthly).
- `groupByCurrency` correctly normalizes a mix of monthly and yearly subs.
- `getUpcoming` for a yearly sub:
  - Renewal in 5 days (date in current year, upcoming) — included with correct `daysUntil`.
  - Renewal in 360 days (date already passed this year, rolls to next year) — excluded.
  - Today (cycle yearly, today's month/day) — included with `daysUntil: 0`.
  - Renewal Feb 29 in a non-leap year — clamps to Feb 28.
- `loadSubscriptions` round-trips a yearly sub with all fields.
- `saveSubscriptions` writes the new fields verbatim.

Server Action validation tests are NOT added (consistent with v2; covered by manual verification).

## Out of Scope for v3

- Auto-advancing `renewalDay`/`renewalMonth` after a renewal occurs (user updates manually if they want to).
- Other cycles (weekly, quarterly).
- Editing existing subs (still remove + re-add).
- Currency conversion (each currency totals separately).
- Theme switcher / dark mode.
- Migration of existing CLI data to add `cycle: "monthly"` (not necessary — absent `cycle` already means monthly).

## Manual Verification

After implementation:
1. Add a monthly sub via the warm/calm dialog → appears in table with `/mo`, charts use the new palette.
2. Add a yearly sub renewing in 220 days → table shows `Yearly` cycle and the formatted date; the monthly total includes `cost/12`.
3. Add a yearly sub renewing in 5 days → appears in "Upcoming this week".
4. Existing monthly sub data (added via CLI) still renders identically.
5. Visual: cream background, terracotta primary button, serif heading, soft shadows, no blue charts.
