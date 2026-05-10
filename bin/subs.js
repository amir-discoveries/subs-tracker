#!/usr/bin/env node
import process from 'node:process';
import { createStore } from '../src/store.js';
import { createAsk } from '../src/prompt.js';
import { UserError, SystemError } from '../src/errors.js';

const COMMANDS = {
  add: () => import('../src/commands/add.js'),
  list: () => import('../src/commands/list.js'),
  total: () => import('../src/commands/total.js'),
  upcoming: () => import('../src/commands/upcoming.js'),
  remove: () => import('../src/commands/remove.js'),
  export: () => import('../src/commands/export.js'),
};

const USAGE = `Usage: subs <command> [args]

Commands:
  add                    Interactively add a subscription
  list                   List subscriptions sorted by cost
  total                  Show monthly/yearly totals by category
  upcoming               Show renewals in the next 7 days
  remove <name>          Remove a subscription
  export [path]          Export to CSV (stdout if no path)
  --help                 Show this help
`;

async function main(argv) {
  const [command, ...args] = argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (!COMMANDS[command]) {
    process.stderr.write(`Unknown command: ${command}\n${USAGE}`);
    return 1;
  }

  const mod = await COMMANDS[command]();
  const store = createStore();
  let activeAsk = null;
  const io = {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    ask: (q) => {
      if (!activeAsk) activeAsk = createAsk({ stdin: process.stdin, stdout: process.stdout });
      return activeAsk(q);
    },
  };

  try {
    await mod.run(args, { store, io });
    return 0;
  } finally {
    if (activeAsk) activeAsk.close();
  }
}

main(process.argv).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    if (err instanceof UserError || err instanceof SystemError) {
      process.stderr.write(`${err.message}\n`);
      process.exitCode = err.exitCode;
    } else {
      process.stderr.write(`${err.stack}\n`);
      process.exitCode = 1;
    }
  },
);
