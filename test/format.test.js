import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, formatTable, csvEscape, toCsv } from '../src/format.js';

test('formatCurrency: 0 -> "0.00"', () => {
  assert.equal(formatCurrency(0), '0.00');
});

test('formatCurrency: 1.5 -> "1.50"', () => {
  assert.equal(formatCurrency(1.5), '1.50');
});

test('formatCurrency: 1234.567 -> "1234.57"', () => {
  assert.equal(formatCurrency(1234.567), '1234.57');
});

test('formatTable aligns columns', () => {
  const out = formatTable([
    ['Netflix', '15.99'],
    ['Spotify', '9.99'],
  ], ['NAME', 'COST']);
  const lines = out.split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^NAME\s+COST$/);
  assert.match(lines[1], /^Netflix\s+15\.99$/);
  assert.match(lines[2], /^Spotify\s+9\.99$/);
});

test('csvEscape: plain value unchanged', () => {
  assert.equal(csvEscape('Netflix'), 'Netflix');
});

test('csvEscape: comma triggers quoting', () => {
  assert.equal(csvEscape('a,b'), '"a,b"');
});

test('csvEscape: quote is doubled and wrapped', () => {
  assert.equal(csvEscape('she said "hi"'), '"she said ""hi"""');
});

test('csvEscape: newline triggers quoting', () => {
  assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
});

test('csvEscape: number stringified', () => {
  assert.equal(csvEscape(15.99), '15.99');
});

test('toCsv writes header and rows with trailing newline', () => {
  const out = toCsv(
    [['Netflix', 15.99, 'USD']],
    ['name', 'cost', 'currency'],
  );
  assert.equal(out, 'name,cost,currency\nNetflix,15.99,USD\n');
});

test('toCsv escapes problematic values in rows', () => {
  const out = toCsv(
    [['Comma, Inc', 1, 'USD']],
    ['name', 'cost', 'currency'],
  );
  assert.equal(out, 'name,cost,currency\n"Comma, Inc",1,USD\n');
});

test('toCsv with no rows returns header only with trailing newline', () => {
  const out = toCsv([], ['name', 'cost']);
  assert.equal(out, 'name,cost\n');
});
