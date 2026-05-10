import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Subscription = {
  name: string;
  cost: number;
  currency: string;
  category: string;
  renewalDay: number;
};

function resolvePath(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.SUBS_DATA_PATH) return process.env.SUBS_DATA_PATH;
  return join(homedir(), '.subs', 'data.json');
}

export async function loadSubscriptions(path?: string): Promise<Subscription[]> {
  const resolved = resolvePath(path);
  let raw: string;
  try {
    raw = await readFile(resolved, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${resolved} is not valid JSON`);
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { subscriptions?: unknown }).subscriptions)
  ) {
    throw new Error(`${resolved} has unexpected shape (missing subscriptions array)`);
  }
  return (parsed as { subscriptions: Subscription[] }).subscriptions;
}
