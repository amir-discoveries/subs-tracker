import { formatTable, formatCurrency } from '../format.js';

const HEADERS = ['NAME', 'COST', 'CURRENCY', 'CATEGORY', 'RENEWAL'];

export async function run(args, { store, io }) {
  const subs = await store.load();
  if (subs.length === 0) {
    io.stdout.write("No subscriptions yet. Run 'subs add' to add one.\n");
    return;
  }
  const sorted = [...subs].sort((a, b) => b.cost - a.cost);
  const rows = sorted.map((s) => [
    s.name,
    formatCurrency(s.cost),
    s.currency,
    s.category,
    String(s.renewalDay),
  ]);
  io.stdout.write(formatTable(rows, HEADERS) + '\n');
}
