import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { SystemError } from './errors.js';

export const DEFAULT_DATA_PATH = join(homedir(), '.subs', 'data.json');
const CURRENT_VERSION = 1;

export function createStore(dataPath = DEFAULT_DATA_PATH) {
  return {
    async load() {
      let raw;
      try {
        raw = await readFile(dataPath, 'utf8');
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw new SystemError(`Cannot read ${dataPath}: ${err.message}`);
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new SystemError(`${dataPath} is not valid JSON. Fix or remove it.`);
      }
      if (!parsed || !Array.isArray(parsed.subscriptions)) {
        throw new SystemError(`${dataPath} has unexpected shape (missing subscriptions array).`);
      }
      return parsed.subscriptions;
    },

    async save(subscriptions) {
      const dir = dirname(dataPath);
      try {
        await mkdir(dir, { recursive: true });
      } catch (err) {
        throw new SystemError(`Cannot create ${dir}: ${err.message}`);
      }
      const tmpPath = `${dataPath}.tmp`;
      const payload = JSON.stringify({ version: CURRENT_VERSION, subscriptions }, null, 2);
      try {
        await writeFile(tmpPath, payload, 'utf8');
        await rename(tmpPath, dataPath);
      } catch (err) {
        throw new SystemError(`Cannot write ${dataPath}: ${err.message}`);
      }
    },
  };
}
