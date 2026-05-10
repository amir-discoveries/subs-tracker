export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function nextRenewal(renewalDay, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();
  const thisMonthClamped = Math.min(renewalDay, daysInMonth(year, month));
  if (todayDay <= thisMonthClamped) {
    return new Date(year, month, thisMonthClamped);
  }
  const rawNextMonth = month + 1;
  const nextYear = year + Math.floor(rawNextMonth / 12);
  const nextMonth = rawNextMonth % 12;
  const nextClamped = Math.min(renewalDay, daysInMonth(nextYear, nextMonth));
  return new Date(nextYear, nextMonth, nextClamped);
}

export function daysUntil(date, today = new Date()) {
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startTarget - startToday) / (1000 * 60 * 60 * 24));
}

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function inDaysPhrase(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'in 1 day';
  return `in ${n} days`;
}
