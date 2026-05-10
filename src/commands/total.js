import { formatCurrency } from '../format.js';

const CATEGORY_COL_WIDTH = 15;

export async function run(args, { store, io }) {
  const subs = await store.load();
  if (subs.length === 0) {
    io.stdout.write('No subscriptions yet.\n');
    return;
  }
  const byCurrency = new Map();
  for (const s of subs) {
    if (!byCurrency.has(s.currency)) byCurrency.set(s.currency, new Map());
    const cats = byCurrency.get(s.currency);
    cats.set(s.category, (cats.get(s.category) || 0) + s.cost);
  }
  const blocks = [];
  for (const cur of [...byCurrency.keys()].sort()) {
    const cats = byCurrency.get(cur);
    const lines = [cur];
    let total = 0;
    for (const cat of [...cats.keys()].sort()) {
      const m = cats.get(cat);
      total += m;
      lines.push(`  ${cat.padEnd(CATEGORY_COL_WIDTH)} ${formatCurrency(m)} / mo    ${formatCurrency(m * 12)} / yr`);
    }
    lines.push('  ─────────────────────────────────────────');
    lines.push(`  ${'Total'.padEnd(CATEGORY_COL_WIDTH)} ${formatCurrency(total)} / mo    ${formatCurrency(total * 12)} / yr`);
    blocks.push(lines.join('\n'));
  }
  io.stdout.write(blocks.join('\n\n') + '\n');
}
