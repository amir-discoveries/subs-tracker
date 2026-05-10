import { UserError } from '../errors.js';

export async function run(args, { store, io }) {
  const name = args[0];
  if (!name) throw new UserError('Usage: subs remove <name>');
  const subs = await store.load();
  const idx = subs.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) throw new UserError(`Subscription "${name}" not found.`);
  const removed = subs[idx];
  const next = subs.filter((_, i) => i !== idx);
  await store.save(next);
  io.stdout.write(`Removed "${removed.name}".\n`);
}
