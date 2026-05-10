import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysInMonth, nextRenewal, daysUntil, formatDate, inDaysPhrase } from '../src/dates.js';

test('daysInMonth knows February in non-leap year', () => {
  assert.equal(daysInMonth(2026, 1), 28);
});

test('daysInMonth knows February in leap year', () => {
  assert.equal(daysInMonth(2024, 1), 29);
});

test('daysInMonth knows April has 30 days', () => {
  assert.equal(daysInMonth(2026, 3), 30);
});

test('nextRenewal in same month when renewalDay is later', () => {
  const today = new Date(2026, 4, 10);
  const result = nextRenewal(15, today);
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 4);
  assert.equal(result.getDate(), 15);
});

test('nextRenewal is today when renewalDay equals today', () => {
  const today = new Date(2026, 4, 10);
  const result = nextRenewal(10, today);
  assert.equal(result.getDate(), 10);
  assert.equal(result.getMonth(), 4);
});

test('nextRenewal rolls to next month when today is past renewalDay', () => {
  const today = new Date(2026, 4, 20);
  const result = nextRenewal(15, today);
  assert.equal(result.getMonth(), 5);
  assert.equal(result.getDate(), 15);
});

test('nextRenewal rolls year over from December', () => {
  const today = new Date(2026, 11, 20);
  const result = nextRenewal(15, today);
  assert.equal(result.getFullYear(), 2027);
  assert.equal(result.getMonth(), 0);
  assert.equal(result.getDate(), 15);
});

test('nextRenewal clamps day 31 in February (non-leap)', () => {
  const today = new Date(2026, 1, 1);
  const result = nextRenewal(31, today);
  assert.equal(result.getMonth(), 1);
  assert.equal(result.getDate(), 28);
});

test('nextRenewal clamps day 31 in February (leap)', () => {
  const today = new Date(2024, 1, 1);
  const result = nextRenewal(31, today);
  assert.equal(result.getMonth(), 1);
  assert.equal(result.getDate(), 29);
});

test('nextRenewal clamps day 31 in April', () => {
  const today = new Date(2026, 3, 1);
  const result = nextRenewal(31, today);
  assert.equal(result.getMonth(), 3);
  assert.equal(result.getDate(), 30);
});

test('daysUntil returns 0 for same day, ignoring time', () => {
  const today = new Date(2026, 4, 10, 23, 59);
  const date = new Date(2026, 4, 10, 0, 0);
  assert.equal(daysUntil(date, today), 0);
});

test('daysUntil returns 1 for tomorrow', () => {
  const today = new Date(2026, 4, 10);
  const date = new Date(2026, 4, 11);
  assert.equal(daysUntil(date, today), 1);
});

test('daysUntil returns 7 for one week ahead', () => {
  const today = new Date(2026, 4, 10);
  const date = new Date(2026, 4, 17);
  assert.equal(daysUntil(date, today), 7);
});

test('formatDate produces YYYY-MM-DD with zero-padding', () => {
  assert.equal(formatDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('inDaysPhrase: 0 = "today"', () => {
  assert.equal(inDaysPhrase(0), 'today');
});

test('inDaysPhrase: 1 = "in 1 day"', () => {
  assert.equal(inDaysPhrase(1), 'in 1 day');
});

test('inDaysPhrase: 7 = "in 7 days"', () => {
  assert.equal(inDaysPhrase(7), 'in 7 days');
});
