import { nextRenewal, daysUntil, formatDate, inDaysPhrase } from '../dates.js';

export async function run(args, { store, io, now = new Date() }) {
  const subs = await store.load();
  const upcoming = subs
    .map((sub) => {
      const date = nextRenewal(sub.renewalDay, now);
      return { sub, date, days: daysUntil(date, now) };
    })
    .filter((x) => x.days >= 0 && x.days <= 7)
    .sort((a, b) => a.days - b.days);

  if (upcoming.length === 0) {
    io.stdout.write('No renewals in the next 7 days.\n');
    return;
  }

  for (const { sub, date, days } of upcoming) {
    io.stdout.write(`${sub.name} — renews ${formatDate(date)} (${inDaysPhrase(days)})\n`);
  }
}
