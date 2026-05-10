# subs Web Dashboard CRUD (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Add/Remove flows to the dashboard so the user can manage subscriptions entirely through `localhost:3000` without using the CLI.

**Architecture:** Writes happen via Next.js Server Actions in `app/actions.ts`, calling a new `saveSubscriptions(subs, path?)` in `web/lib/data.ts`. The save uses the same atomic `write-tmp + rename` pattern the CLI uses in [src/store.js](../../../src/store.js). A new server-rendered `SubscriptionsTable` lists every sub with a per-row Remove form; a top-right "Add subscription" button opens a client-side `Dialog` whose form invokes the addSubscription action via React 19's `useActionState`. After every successful write, `revalidatePath('/')` triggers a fresh server render.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19 (`useActionState`, `useFormStatus`), Tailwind v4, shadcn/ui (`card` already present; adds `dialog`, `input`, `label`; `button` already present), Vitest 4.

---

## Environment Note

`node` and `npm` are NOT on PATH. **Every Bash command in this plan that runs node/npm/npx must be prefixed with:**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && <command>
```

Each Bash call is its own shell — repeat the eval each time.

## Next 16 Note

`web/AGENTS.md` warns: *"This is NOT the Next.js you know — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."* Task 3 includes a quick docs-check step before writing Server Actions. If the API in this repo's installed Next differs from what's in this plan, follow the installed docs and adapt the code while keeping the same behavior.

## File Changes

```
web/
├── app/
│   ├── page.tsx                         # MODIFIED — add header w/ button + SubscriptionsTable section
│   └── actions.ts                       # NEW — 'use server', addSubscription + removeSubscription
├── components/
│   ├── subscriptions-table.tsx          # NEW — server component, table + per-row Remove form
│   ├── add-subscription-dialog.tsx      # NEW — client component, Dialog + useActionState form
│   └── ui/                              # NEW shadcn primitives (added via CLI): dialog, input, label
└── lib/
    ├── data.ts                          # MODIFIED — append saveSubscriptions
    └── data.test.ts                     # MODIFIED — append saveSubscriptions tests
```

Each file's responsibility:

- `lib/data.ts` — pure file I/O + transforms. Adds `saveSubscriptions`. Stays the only tested module.
- `app/actions.ts` — server-side validation + duplicate-name guard + revalidate. Thin wrapper around `loadSubscriptions`/`saveSubscriptions`. No tests; covered via Task 7 manual verification.
- `components/subscriptions-table.tsx` — server component, renders all subs, per-row `<form action={removeSubscription}>` (works with no client JS).
- `components/add-subscription-dialog.tsx` — client component, holds `Dialog` open state, runs the action via `useActionState`, closes on `{ok: true}`, renders `{error}` inline.

---

## Task 1: TDD `saveSubscriptions`

**Files:**
- Modify: `web/lib/data.ts`
- Modify: `web/lib/data.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `web/lib/data.test.ts`:

```ts
import { saveSubscriptions } from './data';
import { readFile, readdir, mkdir, writeFile as writeFileFn } from 'node:fs/promises';

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
```

- [ ] **Step 2: Run tests — confirm failure**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```

Expected: previous 18 tests still pass; the 6 new tests fail with `saveSubscriptions is not a function` or import-resolution errors.

- [ ] **Step 3: Implement `saveSubscriptions`**

Append to `web/lib/data.ts`:

```ts
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function saveSubscriptions(subs: Subscription[], path?: string): Promise<void> {
  const resolved = resolvePath(path);
  await mkdir(dirname(resolved), { recursive: true });
  const tmp = `${resolved}.tmp`;
  const payload = JSON.stringify({ version: 1, subscriptions: subs }, null, 2);
  await writeFile(tmp, payload, 'utf8');
  await rename(tmp, resolved);
}
```

Also: update the existing top-of-file `import` line so all `node:fs/promises` and `node:path` imports stay together. Final imports at the top of `web/lib/data.ts`:

```ts
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
```

(Replaces the existing 3 import lines.)

- [ ] **Step 4: Run tests — confirm pass**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```

Expected: 24 tests pass (18 prior + 6 new).

- [ ] **Step 5: Commit**

```bash
git add web/lib/data.ts web/lib/data.test.ts
git commit -m "feat(web): add saveSubscriptions with atomic write

Mirrors src/store.js: writes to <path>.tmp, renames into place, and
mkdir -p's the parent directory. Used by the new Server Actions in
the next task."
```

---

## Task 2: Add shadcn `dialog`, `input`, `label` primitives

**Files:**
- Create: `web/components/ui/dialog.tsx`, `web/components/ui/input.tsx`, `web/components/ui/label.tsx` (via shadcn CLI)

- [ ] **Step 1: Add via shadcn CLI**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npx --yes shadcn@latest add dialog input label
```

Expected: creates the three component files under `web/components/ui/` and may install transitive deps (@base-ui/react primitives). Exits 0. If the CLI prompts, accept defaults.

- [ ] **Step 2: Verify the new files exist and the project still type-checks**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && ls components/ui/dialog.tsx components/ui/input.tsx components/ui/label.tsx && npx tsc --noEmit
```

Expected: all three paths listed; `tsc` exits 0 with no output.

- [ ] **Step 3: Note the actual exports**

Read `web/components/ui/dialog.tsx` and confirm it exports at minimum `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`, `DialogFooter`. Modern shadcn's base-nova `Dialog` may also export `DialogDescription`, `DialogClose`. Use the actual export names in subsequent tasks.

If the export names differ from the consumers in Task 5 (e.g. `DialogContent` is named `DialogPanel`), adjust Task 5's imports to match. The behavior is identical; only names differ.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat(web): add shadcn dialog, input, label primitives"
```

---

## Task 3: Server Actions (`app/actions.ts`)

**Files:**
- Create: `web/app/actions.ts`

- [ ] **Step 1: Skim the Next 16 Server Actions docs**

Run:
```bash
ls web/node_modules/next/dist/docs/ 2>/dev/null
```

If a docs directory exists, look for files about server actions, form actions, or `useActionState`. The `'use server'` directive at the top of a file marks every export as a Server Action. Confirm the import path for `revalidatePath` (still `'next/cache'` in Next 14/15/16). If the docs disagree with the code below, follow the docs and adjust types/imports — keep the validation + duplicate-name + revalidate behavior identical.

- [ ] **Step 2: Create `app/actions.ts`**

Create `web/app/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { loadSubscriptions, saveSubscriptions, type Subscription } from "@/lib/data";

export type AddState = { ok: true } | { error: string } | null;

function getString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function validate(form: FormData): { sub: Subscription } | { error: string } {
  const name = getString(form, "name");
  if (!name) return { error: "Name is required." };
  if (name.length > 100) return { error: "Name must be 100 characters or fewer." };

  const costStr = getString(form, "cost");
  const cost = Number.parseFloat(costStr);
  if (!Number.isFinite(cost) || cost <= 0) return { error: "Cost must be greater than 0." };
  if (cost > 1_000_000) return { error: "Cost is unrealistically large." };

  const currency = getString(form, "currency");
  if (!currency) return { error: "Currency is required." };
  if (currency.length > 10) return { error: "Currency must be 10 characters or fewer." };

  const category = getString(form, "category");
  if (!category) return { error: "Category is required." };
  if (category.length > 50) return { error: "Category must be 50 characters or fewer." };

  const renewalDayStr = getString(form, "renewalDay");
  const renewalDay = Number.parseInt(renewalDayStr, 10);
  if (!Number.isInteger(renewalDay) || renewalDay < 1 || renewalDay > 31) {
    return { error: "Renewal day must be a whole number between 1 and 31." };
  }

  return { sub: { name, cost, currency, category, renewalDay } };
}

export async function addSubscription(_prevState: AddState, formData: FormData): Promise<AddState> {
  const validated = validate(formData);
  if ("error" in validated) return { error: validated.error };

  let subs: Subscription[];
  try {
    subs = await loadSubscriptions();
  } catch (err) {
    return { error: `Couldn't read data file: ${(err as Error).message}` };
  }

  const newName = validated.sub.name.toLowerCase();
  if (subs.some((s) => s.name.toLowerCase() === newName)) {
    return { error: `A subscription named "${validated.sub.name}" already exists.` };
  }

  try {
    await saveSubscriptions([...subs, validated.sub]);
  } catch (err) {
    return { error: `Couldn't save: ${(err as Error).message}` };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function removeSubscription(formData: FormData): Promise<void> {
  const name = getString(formData, "name").toLowerCase();
  if (!name) return;

  const subs = await loadSubscriptions();
  const next = subs.filter((s) => s.name.toLowerCase() !== name);
  if (next.length === subs.length) return; // already gone

  await saveSubscriptions(next);
  revalidatePath("/");
}
```

- [ ] **Step 3: Verify type-check**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 4: Verify the existing tests still pass**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```

Expected: 24/24 pass (no regression). The actions themselves aren't unit-tested; they're verified end-to-end in Task 7.

- [ ] **Step 5: Commit**

```bash
git add web/app/actions.ts
git commit -m "feat(web): add Server Actions for add/remove subscription

addSubscription validates input, rejects duplicate names (case-
insensitive), saves atomically, and revalidates the dashboard.
removeSubscription is a form-action variant for per-row Remove."
```

---

## Task 4: `SubscriptionsTable` server component

**Files:**
- Create: `web/components/subscriptions-table.tsx`

- [ ] **Step 1: Create the component**

Create `web/components/subscriptions-table.tsx`:

```tsx
import type { Subscription } from "@/lib/data";
import { removeSubscription } from "@/app/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = { subs: Subscription[] };

export function SubscriptionsTable({ subs }: Props) {
  const sorted = [...subs].sort((a, b) => b.cost - a.cost);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriptions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium text-right">Cost</th>
                <th className="py-2 pr-4 font-medium">Currency</th>
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 pr-4 font-medium text-right">Renews</th>
                <th className="py-2 pr-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((s) => (
                <tr key={s.name}>
                  <td className="py-2 pr-4 font-medium">{s.name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{s.cost.toFixed(2)}</td>
                  <td className="py-2 pr-4">{s.currency}</td>
                  <td className="py-2 pr-4">{s.category}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">day {s.renewalDay}</td>
                  <td className="py-2 pr-2 text-right">
                    <form action={removeSubscription}>
                      <input type="hidden" name="name" value={s.name} />
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
```

If the shadcn `Button` doesn't accept `variant="ghost"` in this preset, drop the `variant` prop and use `className="text-destructive hover:underline"` instead. Read `web/components/ui/button.tsx` to see the actual variant API.

- [ ] **Step 2: Verify type-check**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npx tsc --noEmit
```

Expected: exit 0. If a Button variant complaint appears, fix per the note above.

- [ ] **Step 3: Commit**

```bash
git add web/components/subscriptions-table.tsx
git commit -m "feat(web): add SubscriptionsTable server component

Renders all subs sorted by cost desc with a per-row Remove form
that posts directly to the removeSubscription Server Action.
Works with progressive enhancement (no client JS required)."
```

---

## Task 5: `AddSubscriptionDialog` client component

**Files:**
- Create: `web/components/add-subscription-dialog.tsx`

- [ ] **Step 1: Read the dialog exports**

Run: `grep '^export' web/components/ui/dialog.tsx`. Note the exact export names (some shadcn presets export `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose`; if any are missing or named differently, adjust the imports in Step 2).

- [ ] **Step 2: Create the component**

Create `web/components/add-subscription-dialog.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addSubscription, type AddState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add subscription"}
    </Button>
  );
}

export function AddSubscriptionDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<AddState, FormData>(addSubscription, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Add subscription</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a subscription</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="cost">Cost (monthly)</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" required maxLength={10} defaultValue="USD" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" required maxLength={50} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="renewalDay">Renews on day</Label>
              <Input
                id="renewalDay"
                name="renewalDay"
                type="number"
                min="1"
                max="31"
                required
              />
            </div>
          </div>
          {state && "error" in state && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

If `useActionState`'s generic signature differs in this React version, drop the explicit `<AddState, FormData>` and let inference handle it. The runtime contract is `(prevState, formData) => Promise<AddState>` and the component calls `formAction(formData)` via `<form action={formAction}>`.

If `text-destructive` is not a Tailwind utility in this theme, use `text-red-600` (any visible-red color) — the validation feedback just needs to be obviously different from neutral text.

- [ ] **Step 3: Verify type-check**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npx tsc --noEmit
```

Expected: exit 0. Adapt imports per Step 1 / Step 2 notes if errors appear.

- [ ] **Step 4: Commit**

```bash
git add web/components/add-subscription-dialog.tsx
git commit -m "feat(web): add AddSubscriptionDialog client component

Wraps the add form in a shadcn Dialog. Uses React 19's
useActionState to call addSubscription; closes and resets on
{ok:true}, shows server-side validation errors inline."
```

---

## Task 6: Wire into `app/page.tsx`

**Files:**
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

Overwrite `web/app/page.tsx` with:

```tsx
import { loadSubscriptions, groupByCurrency, getUpcoming } from "@/lib/data";
import { TotalsCards } from "@/components/totals-cards";
import { CategoryPie } from "@/components/category-pie";
import { CostBar } from "@/components/cost-bar";
import { UpcomingList } from "@/components/upcoming-list";
import { SubscriptionsTable } from "@/components/subscriptions-table";
import { AddSubscriptionDialog } from "@/components/add-subscription-dialog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const subs = await loadSubscriptions();

  if (subs.length === 0) {
    return (
      <main className="min-h-screen p-6 md:p-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">subs</h1>
            <AddSubscriptionDialog />
          </div>
          <p className="text-center text-muted-foreground py-24">
            No subscriptions yet — click <span className="font-medium">Add subscription</span> to get started.
          </p>
        </div>
      </main>
    );
  }

  const buckets = groupByCurrency(subs);
  const upcoming = getUpcoming(subs);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">subs</h1>
          <AddSubscriptionDialog />
        </div>
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
        <SubscriptionsTable subs={subs} />
        <UpcomingList items={upcoming} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify type-check + tests**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npx tsc --noEmit && npm test
```

Expected: tsc exits 0; tests show 24/24 passing.

- [ ] **Step 3: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat(web): wire add/remove into dashboard page

Top-right Add subscription button (works in both empty and populated
states), SubscriptionsTable section between charts and Upcoming list."
```

---

## Task 7: End-to-end manual verification

This task verifies the full Add and Remove flows against a fixture file. No commit — verification only.

- [ ] **Step 1: Create a writable fixture**

```bash
mkdir -p /tmp/subs-crud-fixture && cat > /tmp/subs-crud-fixture/data.json <<'EOF'
{
  "version": 1,
  "subscriptions": [
    { "name": "Netflix", "cost": 15.99, "currency": "USD", "category": "entertainment", "renewalDay": 5 },
    { "name": "Spotify", "cost": 9.99,  "currency": "USD", "category": "music",         "renewalDay": 12 }
  ]
}
EOF
```

- [ ] **Step 2: Start the dev server pointing at the fixture (background)**

```bash
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && SUBS_DATA_PATH=/tmp/subs-crud-fixture/data.json npm run dev
```

(Run with `run_in_background: true`, wait ~8s for "Ready in" / "Local:".)

- [ ] **Step 3: Sanity-check that the table + Add button render**

```bash
RESPONSE=$(curl -sf http://localhost:3000)
for s in "Subscriptions" "Add subscription" "Netflix" "Spotify" "Remove"; do
  if echo "$RESPONSE" | grep -qF "$s"; then echo "OK: $s"; else echo "MISSING: $s"; fi
done
```

Expected: every line prints `OK:`. The Add dialog itself isn't rendered until clicked (it's inside `<DialogContent>` which Radix-style dialogs portal in on open), so seeing the Add button is the right signal.

- [ ] **Step 4: Open in a browser and exercise the flows**

Open `http://localhost:3000`. Confirm:

1. **Add a sub**
   - Click "+ Add subscription".
   - Fill: Name = `Hulu`, Cost = `7.99`, Currency = `USD`, Category = `entertainment`, Renews on day = `18`.
   - Click "Add subscription".
   - Dialog closes; the page re-renders; "Hulu" appears in the table; USD totals jump from 25.98/311.76 to 33.97/407.64; entertainment slice grows in the pie.

2. **Validation rejection**
   - Click Add again, try Cost = `-1`. Submit. Expect inline error "Cost must be greater than 0."
   - Try Cost = `5`, Renewal day = `45`. Submit. Expect "Renewal day must be a whole number between 1 and 31."
   - Try a duplicate Name = `Netflix`. Submit. Expect "A subscription named "Netflix" already exists." (Note: comparison is case-insensitive — try `netflix` too; same error.)

3. **Remove a sub**
   - In the table, click "Remove" on Spotify. The page re-renders; Spotify is gone; USD totals drop accordingly.

4. **Empty state Add**
   - Stop the dev server. Restart with `SUBS_DATA_PATH=/tmp/subs-crud-fixture/empty.json` (a file that doesn't exist). The empty-state message should render with the "Add subscription" button visible. Click it, add a sub, confirm the page transitions to the populated view with the new sub showing.

If any step fails, read the dev server's background output for stack traces, fix the underlying issue (often: a Recharts/shadcn type quirk in the new code), commit the fix on top, and re-verify.

- [ ] **Step 5: Stop the dev server and re-run the test suite**

```bash
pkill -f "next dev" || true
eval "$(fnm env --use-on-cd)" && fnm use default && cd web && npm test
```

Expected: `pgrep -f "next dev"` empty; tests show 24/24 passing.

- [ ] **Step 6: Clean up the fixture**

```bash
rm -rf /tmp/subs-crud-fixture
```

- [ ] **Step 7: No commit needed**

This task only verified existing committed code.

---

## Done

`npm run dev` from `web/` now serves a fully self-contained dashboard at `localhost:3000` — no CLI required to add or remove subscriptions. The CLI continues to work against the same `~/.subs/data.json` file unchanged.
