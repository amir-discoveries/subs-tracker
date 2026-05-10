# subs Web Dashboard — Add/Remove (v2)

## Overview

Adds write capabilities to the read-only dashboard built in v1. After v2 the user can add and remove subscriptions entirely through `localhost:3000`, without touching the CLI. Editing is intentionally out of scope — to change a subscription, remove and re-add (same constraint the CLI has).

The same `~/.subs/data.json` file backs both the CLI and the dashboard. Writes from the web UI use the same atomic write pattern (write `.tmp`, rename) as [src/store.js](../../../src/store.js) so a crash mid-save can't leave the file in a partial state. Last-write-wins concurrency between the CLI and the web app is acceptable for a single-user local tool.

## Architecture

- **Server Actions** (Next.js App Router, `'use server'`) handle the writes. No API routes.
- **Server-rendered table** lists all subscriptions with per-row Remove. Remove uses a plain `<form action={...}>` with a hidden field — works without client-side JavaScript.
- **Client dialog** wraps the Add form (shadcn `Dialog`). Submit invokes the `addSubscription` Server Action; on success the dialog closes and the page re-renders via `revalidatePath('/')`.

## File Changes

```
web/
├── app/
│   ├── page.tsx                         # MODIFIED — add Subscriptions section + Add button at top
│   └── actions.ts                       # NEW — 'use server', exports addSubscription, removeSubscription
├── components/
│   ├── subscriptions-table.tsx          # NEW — server component, table with per-row Remove form
│   ├── add-subscription-dialog.tsx      # NEW — client component, Dialog + form
│   └── ui/                              # NEW shadcn primitives: dialog, input, label
└── lib/
    ├── data.ts                          # MODIFIED — adds saveSubscriptions(subs, path?)
    └── data.test.ts                     # MODIFIED — adds tests for saveSubscriptions
```

## Data Layer

`lib/data.ts` gains one new exported function:

```ts
saveSubscriptions(subs: Subscription[], path?: string): Promise<void>
```

Behavior, mirroring [src/store.js](../../../src/store.js):

- Path resolution is the existing `resolvePath` helper (explicit arg → `SUBS_DATA_PATH` → `~/.subs/data.json`).
- Creates the parent directory with `mkdir -p` if missing.
- Writes JSON to `<path>.tmp` first, then `rename`s onto `<path>`. The rename is atomic on POSIX; a crash leaves the original file untouched.
- Output shape matches the CLI exactly: `{ "version": 1, "subscriptions": [...] }`, two-space indent.
- I/O errors propagate (no swallow).

## Server Actions (`app/actions.ts`)

```ts
'use server';

addSubscription(input: SubscriptionInput): Promise<{ok: true} | {error: string}>
removeSubscription(formData: FormData): Promise<void>   // form action, redirects/revalidates
```

`SubscriptionInput` is `Subscription` with `cost: string` (HTML form values are strings; the action coerces and validates).

### Validation (server-authoritative)

- `name`: trim, non-empty, ≤ 100 chars.
- `cost`: parse as float, > 0, ≤ 1_000_000.
- `currency`: trim, non-empty, ≤ 10 chars (the CLI doesn't restrict to ISO codes; we don't either).
- `category`: trim, non-empty, ≤ 50 chars.
- `renewalDay`: parse as int, 1 ≤ n ≤ 31.

A validation failure returns `{error: "<human-readable message>"}` from `addSubscription`. The dialog shows it inline.

### Duplicate names

`addSubscription` rejects a new sub whose name matches an existing sub's name (case-insensitive, trimmed) — same as the CLI. Error: `"A subscription named 'X' already exists."`

### Removal

`removeSubscription` reads the `name` field from `FormData`, removes any subscription whose name matches case-insensitively, saves the result. If no match, no-op (silently); the row was probably removed by another tab. After the write, `revalidatePath('/')` updates the dashboard.

## UI Layout

The page becomes:

```
[ Header: "subs"          [ + Add subscription ] ]   ← top row, button right-aligned

[ per-currency sections (existing) ]
  ├─ Total Monthly / Total Yearly
  ├─ Category Pie + Cost Bar
  └─ ...

[ Subscriptions table (new) ]
  ┌───────────┬───────┬──────────┬──────────────┬────────┬─────────┐
  │ Name      │ Cost  │ Currency │ Category     │ Renews │ Actions │
  ├───────────┼───────┼──────────┼──────────────┼────────┼─────────┤
  │ Netflix   │ 15.99 │ USD      │ entertainment│ 5      │ [Remove]│
  │ ...       │       │          │              │        │         │
  └───────────┴───────┴──────────┴──────────────┴────────┴─────────┘

[ Upcoming this week (existing) ]
```

Sort order in the table: cost desc (matches the CLI's `subs list` and the existing bar chart).

## Add Dialog

A shadcn `Dialog` triggered by the top-right Add button. Inputs:

| Field | HTML control | Server validates |
|---|---|---|
| Name | `<input type=text required maxlength=100>` | non-empty, ≤100 |
| Cost | `<input type=number step=0.01 min=0.01 required>` | >0, ≤1M |
| Currency | `<input type=text required maxlength=10>` | non-empty, ≤10 |
| Category | `<input type=text required maxlength=50>` | non-empty, ≤50 |
| Renews on day | `<input type=number min=1 max=31 required>` | 1-31 |

Submit button is disabled while the action is pending (`useFormStatus`). Errors from the server render in a small red banner inside the dialog.

On success, the dialog closes and the page re-renders with the new sub already present.

## Tests

`web/lib/data.test.ts` gains a `describe('saveSubscriptions')` block:

- Writes a valid file with the expected `{version: 1, subscriptions: [...]}` shape.
- Round-trip: `save` then `load` returns equal data.
- Creates parent directory if it doesn't exist.
- Atomic-write contract: after `save`, no `.tmp` file is left behind; the final file exists and parses.
- I/O errors (e.g. EACCES via a read-only file) propagate.

The Server Actions are thin wrappers and not directly tested — they import `loadSubscriptions`/`saveSubscriptions` and Next runtime helpers (`revalidatePath`) that are awkward to mock. The behavior surface is fully covered by data-layer tests + manual verification.

Manual verification (Task 8 of the plan): start the dev server with a fixture file, click Add, fill the dialog, submit, confirm a new row appears and totals update; click Remove on a row, confirm it disappears; restart with a missing data file, confirm the empty-state path still renders with the Add button visible.

## Out of Scope for v2

- Edit existing subscription (remove + re-add as the CLI does).
- Export/CSV download from the web.
- Confirmation dialog on Remove (the CLI also doesn't confirm; one-click remove is consistent).
- Optimistic UI updates (revalidatePath is fast enough for a local single-user app).
- Live-reload across browser tabs (would require WebSockets / SSE).
- Concurrent-edit detection between CLI and web (last-write-wins is fine for one user).
- Authentication (it's localhost only).
