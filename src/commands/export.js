import { writeFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { UserError } from '../errors.js';
import { toCsv } from '../format.js';

const HEADERS = ['name', 'cost', 'currency', 'category', 'renewalDay', 'addedAt'];

export async function run(args, { store, io }) {
  const subs = await store.load();
  const rows = subs.map((s) => [s.name, s.cost, s.currency, s.category, s.renewalDay, s.addedAt]);
  const csv = toCsv(rows, HEADERS);
  const path = args[0];

  if (!path) {
    io.stdout.write(csv);
    return;
  }

  const dir = dirname(path);
  let dirStat;
  try {
    dirStat = await stat(dir);
  } catch {
    throw new UserError(`Directory '${dir}' does not exist.`);
  }
  if (!dirStat.isDirectory()) {
    throw new UserError(`Directory '${dir}' does not exist.`);
  }
  await writeFile(path, csv, 'utf8');
  io.stderr.write(`Exported ${subs.length} subscriptions to ${path}\n`);
}
