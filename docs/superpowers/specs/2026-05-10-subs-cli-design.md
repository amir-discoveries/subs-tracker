# subs — Subscription Tracking CLI

## Overview

`subs` is a Node.js CLI for tracking recurring subscriptions locally. Data is stored in a single JSON file at `~/.subs/data.json`. The tool has no runtime or test dependencies beyond Node built-ins (target Node 18+).

## Commands

| Command | Purpose |
|---|---|
| `subs add` | Interactively add a subscription |
| `subs list` | List subscriptions, sorted by cost desc |
| `subs total` | Monthly and yearly totals, grouped by currency then category |
| `subs upcoming` | Subscriptions renewing in the next 7 days |
| `subs remove <name>` | Remove a subscription (case-insensitive) |
| `subs export [path]` | Export to CSV (stdout if no path) |
| `subs --help` / no args | Print usage |

## Architecture

```
subs/
├── bin/subs.js              # entry point: argv parsing, dispatch, error handler
├── src/
│   ├── store.js             # load/save data.json, atomic writes
│   ├── prompt.js            # readline wrapper for interactive add
│   ├── format.js            # currency / table / CSV formatting
│   ├── dates.js             # next-renewal math with end-of-month clamping
│   └── commands/
│       ├── add.js
│       ├── list.js
│       ├── total.js
│       ├── upcoming.js
│       ├── remove.js
│       └── export.js
├── test/
│   ├── store.test.js
│   ├── format.test.js
│   ├── dates.test.js
│   ├── commands/{add,list,total,upcoming,remove,export}.test.js
│   └── bin.test.js          # one spawn-based smoke test
└── package.json             # bin entry, "test": "node --test test/**/*.test.js"
```

Each command exports a single async function:

```js
async function run(args, { store, io }) { ... }
```

`io` is `{ stdin, stdout, stderr }`, injected so tests can capture output and feed input without spawning subprocesses. `store` is also injectable so tests use a temp-file or in-memory store and never touch `~/.subs/`.

## Data Model

`~/.subs/data.json`:

```json
{
  "version": 1,
  "subscriptions": [
    {
      "name": "Netflix",
      "cost": 15.99,
      "currency": "USD",
      "category": "Entertainment",
      "renewalDay": 14,
      "addedAt": "2026-05-10T12:34:56.000Z"
    }
  ]
}
```

**Field rules:**
- `name` — non-empty trimmed string. Unique key (case-insensitive). `add` rejects duplicates; `remove` matches case-insensitively.
- `cost` — positive number with at most 2 decimal places. Inputs with more than 2 decimals are rejected at `add` time (not silently rounded).
- `currency` — 3 uppercase letters (`/^[A-Z]{3}$/`). No whitelist — keeps the tool dependency-free and flexible.
- `category` — non-empty trimmed string, free-form.
- `renewalDay` — integer 1–31. Months without that day clamp to the last day of that month when computing "upcoming."
- `addedAt` — ISO 8601 timestamp set at creation.
- `version` — schema version, currently `1`. Allows future migrations without guessing.

**Persistence:**
- Atomic writes: write to `data.json.tmp`, then `rename`.
- Missing file → treated as empty list, file (and `~/.subs/`) created on first write.
- Malformed JSON → exit code 2 with a clear error pointing at the file path. Never auto-overwrite user data.

## Command Behavior

### `subs add`
Readline prompts in order: name, cost, currency (default `USD` — empty input accepts the default), category, renewal day (1–31). Each prompt re-asks on invalid input with a specific reason (e.g., "Cost must be a positive number"). Duplicate name → exits with error, no write. Whitespace is trimmed on string fields.

### `subs list`
Sorted by `cost` descending; ties are stable (original insertion order preserved).

```
NAME       COST      CURRENCY  CATEGORY        RENEWAL
Netflix    15.99     USD       Entertainment   14
Spotify     9.99     USD       Entertainment   3
```

Empty list → `No subscriptions yet. Run 'subs add' to add one.`

### `subs total`
Grouped by currency (alphabetical), then by category (alphabetical) within each currency. Yearly = monthly × 12 (no proration).

```
USD
  Entertainment   25.98 / mo    311.76 / yr
  Productivity   12.00 / mo    144.00 / yr
  ─────────────────────────────────────────
  Total          37.98 / mo    455.76 / yr

EUR
  ...
```

Empty list → `No subscriptions yet.`

### `subs upcoming`
Subscriptions whose next renewal date is within 7 days inclusive of today. "Next renewal" = the next occurrence of `renewalDay` on or after today, with end-of-month clamping (e.g., day 31 in February → Feb 28 or 29). Sorted by date ascending.

```
Netflix — renews 2026-05-14 (in 4 days)
Spotify — renews 2026-05-17 (in 7 days)
```

Empty → `No renewals in the next 7 days.`

### `subs remove <name>`
Case-insensitive exact match. Not found → exits 1 with `Subscription "X" not found.` No confirmation prompt. Atomic write of remaining subscriptions.

### `subs export [path]`
CSV with header `name,cost,currency,category,renewalDay,addedAt`. Values quoted only when they contain `,`, `"`, or newline (RFC 4180); embedded `"` doubled. Without a path → writes to stdout. With a path → writes to file and prints `Exported N subscriptions to <path>` to stderr (so it doesn't pollute redirection). Parent directory must exist; if not, exit 1. With no subscriptions, the CSV contains the header row only (and `N` is `0` in the stderr message).

### No args / unknown command / `--help`
Prints usage. Exit 0 for `--help` or no args; exit 1 for unknown command.

## Error Handling

**Exit codes:**
- `0` — success
- `1` — user/input error (bad arg, not found, duplicate, missing export dir)
- `2` — system error (corrupt JSON, permission denied)

**Central handler in `bin/subs.js`:** commands throw typed errors (`UserError`, `SystemError`); the entry catches them, prints a single-line message to stderr, exits with the right code. Unexpected errors print the stack — those are bugs.

**Specific cases:**
- Corrupt `data.json` → `Error: ~/.subs/data.json is not valid JSON. Fix or remove it.` Exit 2.
- `~/.subs/` not writable → exit 2 with the path and underlying errno.
- `add` validation failures inside the readline loop reprompt with the reason (not errors). Errors only on Ctrl-C (clean exit, no partial write) or store failure.
- `remove` on missing name → exit 1.
- `export <path>` with non-existent parent directory → exit 1 with `Directory '<dir>' does not exist.` (No auto-mkdir.)

## Testing Strategy

**Runner:** `node --test test/**/*.test.js`, assertions via `node:assert/strict`.

**Per-module coverage:**

- **`store.test.js`** — load missing file → empty list; round-trip save/load; corrupt JSON throws `SystemError`; atomic write leaves no `.tmp` on success; sequential saves don't lose data.
- **`format.test.js`** — currency formatting (0, large, fractional); CSV escaping (commas, quotes doubled, newlines, plain values unquoted); "in N days" boundaries at 0/1/7.
- **`dates.test.js`** — day 31 in Feb clamps to 28/29 (leap year aware); "next renewal" rolls to next month when today is past `renewalDay`; equals today when `renewalDay === today`.
- **Per-command tests** — each command called directly with an in-memory store and a fake `io` (`PassThrough` streams or string buffers). Assertions on captured stdout/stderr and resulting store state. Edge cases per command:
  - `add` — happy path; rejects duplicate (case-insensitive); reprompts on invalid cost / currency / day; trims whitespace.
  - `list` — empty case; sorted desc; stable ties.
  - `total` — multi-currency grouping; multi-category within currency; yearly = monthly × 12.
  - `upcoming` — within window; boundary at 0 and 7 days; outside window; end-of-month clamping; sorted by date.
  - `remove` — case-insensitive match; not-found exits 1; only the named sub removed.
  - `export` — stdout default; file path writes file and prints to stderr; CSV escaping; bad path exits 1.
- **`bin.test.js`** — one `child_process.spawn` test of `node bin/subs.js list` against a temp `HOME`, asserting the empty-state message. Catches wiring bugs unit tests miss.

**Isolation:** every test that touches the store uses `os.tmpdir()` + `fs.mkdtempSync` and overrides the data path. No test ever touches the real `~/.subs/`.

## Out of Scope (v1)

- Multi-currency conversion (totals are grouped by currency instead).
- Non-monthly billing cycles (weekly, yearly, custom intervals).
- Editing existing subscriptions (`remove` + `add` is the workflow).
- Notifications or background processes.
- Multi-user / multi-profile support.
