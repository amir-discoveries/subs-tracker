import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserError, SystemError } from '../src/errors.js';

test('UserError carries message and exitCode 1', () => {
  const err = new UserError('bad input');
  assert.equal(err.message, 'bad input');
  assert.equal(err.exitCode, 1);
  assert.equal(err.name, 'UserError');
  assert.ok(err instanceof Error);
});

test('SystemError carries message and exitCode 2', () => {
  const err = new SystemError('disk full');
  assert.equal(err.message, 'disk full');
  assert.equal(err.exitCode, 2);
  assert.equal(err.name, 'SystemError');
  assert.ok(err instanceof Error);
});
