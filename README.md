# subs — Track Your Subscription Bleed

Track every recurring subscription you're paying for. See exactly how much money is leaking each month, broken down by category and currency. Built solo with [Claude Code](https://claude.com/code) and the [Superpowers](https://github.com/obra/superpowers) plugin in one session.

<img width="1232" height="1036" alt="screenshot" src="https://github.com/user-attachments/assets/25b61c16-5c53-47fe-a449-f757118a7521" />


## What It Does

- **CLI** — fast, scriptable, lives in your terminal: `subs add`, `subs list`, `subs total`, `subs upcoming`, `subs remove`, `subs export`
- **Web Dashboard** — visual breakdown with cards, pie chart, and bar chart. Reads from the same data file as the CLI.
- **Local-only data** — your subscriptions live at `~/.subs/data.json`. Nothing sent to any server.
- **Multi-currency support** — totals grouped per currency (USD, EUR, AED, etc.).
- **Zero CLI dependencies** — pure Node built-ins. No npm install bloat.

## Install

```bash
git clone https://github.com/amir-discoveries/subs-tracker.git
cd subs-tracker
npm link        # makes `subs` available globally

# To run the web dashboard:
cd web
npm install
npm run dev     # opens http://localhost:3000
```

## Usage

```bash
subs add                      # add a subscription interactively
subs list                     # list all subscriptions
subs total                    # see your monthly + yearly damage
subs upcoming                 # what renews in the next 7 days
subs remove Netflix           # remove a subscription
subs export                   # dump CSV to stdout
subs export ~/Desktop/subs.csv  # write to a file
```

## How It Was Built

The full methodology — planning, test-driven development, parallel subagents, two-stage code review — was handled automatically by Claude Code with the Superpowers plugin. 115 tests (80 CLI + 35 web), written before the code. Every commit is in the git history.

[Watch the build on YouTube](https://www.youtube.com/@amirdiscoveries) ← link to your video once it's published

## License

MIT
