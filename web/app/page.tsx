import { loadSubscriptions, groupByCurrency, getUpcoming } from "@/lib/data";
import { TotalsCards } from "@/components/totals-cards";
import { CategoryPie } from "@/components/category-pie";
import { CostBar } from "@/components/cost-bar";
import { UpcomingList } from "@/components/upcoming-list";

export const dynamic = "force-dynamic";

export default async function Page() {
  const subs = await loadSubscriptions();

  if (subs.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-center text-muted-foreground">
          No subscriptions yet — run <code className="font-mono">subs add</code> to add one.
        </p>
      </main>
    );
  }

  const buckets = groupByCurrency(subs);
  const upcoming = getUpcoming(subs);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-12">
        <h1 className="text-2xl font-semibold tracking-tight">subs</h1>
        {buckets.map((b) => (
          <section key={b.currency} className="space-y-6">
            {buckets.length > 1 && (
              <h2 className="text-lg font-medium text-muted-foreground">{b.currency}</h2>
            )}
            <TotalsCards
              currency={b.currency}
              totalMonthly={b.totalMonthly}
              totalYearly={b.totalYearly}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryPie data={b.byCategory} currency={b.currency} />
              <CostBar data={b.bySubscription} currency={b.currency} />
            </div>
          </section>
        ))}
        <UpcomingList items={upcoming} />
      </div>
    </main>
  );
}
