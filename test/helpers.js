import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.js';

export async function withTempStore() {
  const dir = await mkdtemp(join(tmpdir(), 'subs-test-'));
  const path = join(dir, 'data.json');
  const store = createStore(path);
  const cleanup = () => rm(dir, { recursive: true, force: true });
  return { store, path, dir, cleanup };
}

export function inMemoryStore(initial = []) {
  let data = initial.map((s) => ({ ...s }));
  return {
    async load() {
      return data.map((s) => ({ ...s }));
    },
    async save(subs) {
      data = subs.map((s) => ({ ...s }));
    },
    get current() {
      return data;
    },
  };
}

export function captureIo(answers = []) {
  const stdoutChunks = [];
  const stderrChunks = [];
  const queue = [...answers];
  const io = {
    stdin: null,
    stdout: { write: (s) => stdoutChunks.push(s) },
    stderr: { write: (s) => stderrChunks.push(s) },
    ask: async () => {
      if (queue.length === 0) throw new Error('No more scripted answers');
      return queue.shift();
    },
  };
  return {
    io,
    stdout: () => stdoutChunks.join(''),
    stderr: () => stderrChunks.join(''),
    remaining: () => queue.length,
  };
}
