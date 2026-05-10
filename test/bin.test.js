import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = resolve(import.meta.dirname, '..', 'bin', 'subs.js');

function runBin(args, env = {}, stdinInput = null) {
  return new Promise((resolveFn, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      env: { ...process.env, ...env },
      stdio: [stdinInput == null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    const out = [];
    const err = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      resolveFn({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      });
    });
    if (stdinInput != null) {
      child.stdin.end(stdinInput);
    }
  });
}

test('bin: --help prints usage and exits 0', async () => {
  const { code, stdout } = await runBin(['--help']);
  assert.equal(code, 0);
  assert.match(stdout, /Usage: subs/);
});

test('bin: no args prints usage and exits 0', async () => {
  const { code, stdout } = await runBin([]);
  assert.equal(code, 0);
  assert.match(stdout, /Usage: subs/);
});

test('bin: unknown command prints error and exits 1', async () => {
  const { code, stderr } = await runBin(['bogus']);
  assert.equal(code, 1);
  assert.match(stderr, /Unknown command: bogus/);
});

test('bin: list against fresh HOME prints empty-state and exits 0', async () => {
  const home = await mkdtemp(join(tmpdir(), 'subs-bin-'));
  try {
    const { code, stdout } = await runBin(['list'], { HOME: home });
    assert.equal(code, 0);
    assert.match(stdout, /No subscriptions yet/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('bin: list with corrupt data file exits 2', async () => {
  const home = await mkdtemp(join(tmpdir(), 'subs-bin-'));
  try {
    await mkdir(join(home, '.subs'), { recursive: true });
    await writeFile(join(home, '.subs', 'data.json'), '{not json', 'utf8');
    const { code, stderr } = await runBin(['list'], { HOME: home });
    assert.equal(code, 2);
    assert.match(stderr, /not valid JSON/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('bin: remove with non-existent name exits 1', async () => {
  const home = await mkdtemp(join(tmpdir(), 'subs-bin-'));
  try {
    const { code, stderr } = await runBin(['remove', 'Ghost'], { HOME: home });
    assert.equal(code, 1);
    assert.match(stderr, /not found/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('bin: add with truncated stdin exits 1 cleanly (no infinite loop)', async () => {
  const home = await mkdtemp(join(tmpdir(), 'subs-bin-'));
  try {
    const { code, stderr } = await runBin(['add'], { HOME: home }, 'Netflix\n');
    assert.equal(code, 1);
    assert.match(stderr, /Input ended before all prompts/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('bin: add via piped stdin saves all 5 fields', async () => {
  const home = await mkdtemp(join(tmpdir(), 'subs-bin-'));
  try {
    const input = 'Netflix\n15.99\nUSD\nEntertainment\n14\n';
    const { code, stdout } = await runBin(['add'], { HOME: home }, input);
    assert.equal(code, 0);
    assert.match(stdout, /Added "Netflix"/);
    const data = JSON.parse(await readFile(join(home, '.subs', 'data.json'), 'utf8'));
    assert.equal(data.subscriptions.length, 1);
    assert.deepEqual(
      { ...data.subscriptions[0], addedAt: 'redacted' },
      { name: 'Netflix', cost: 15.99, currency: 'USD', category: 'Entertainment', renewalDay: 14, addedAt: 'redacted' },
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
