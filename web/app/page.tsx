import { loadSubscriptions, groupByCurrency, getUpcoming } from "@/lib/data";
import { TotalsCards } from "@/components/totals-cards";
import { CategoryPie } from "@/components/category-pie";
import { CostBar } from "@/components/cost-bar";
import { UpcomingList } from "@/components/upcoming-list";
import { SubscriptionsTable } from "@/components/subscriptions-table";
import { AddSubscriptionDialog } from "@/components/add-subscription-dialog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const subs = await loadSubscriptions();

  if (subs.length === 0) {
    return (
      <main className="min-h-screen p-6 md:p-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-heading italic">subs</h1>
              <p className="text-sm text-muted-foreground">your subscriptions, calmly tracked</p>
            </div>
            <AddSubscriptionDialog />
          </div>
          <p className="text-center text-muted-foreground py-24">
            No subscriptions yet — click <span className="font-medium">Add subscription</span> to get started.
          </p>
        </div>
      </main>
    );
  }

  const buckets = groupByCurrency(subs);
  const upcoming = getUpcoming(subs);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading italic">subs</h1>
            <p className="text-sm text-muted-foreground">your subscriptions, calmly tracked</p>
          </div>
          <AddSubscriptionDialog />
        </div>
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
        <SubscriptionsTable subs={subs} />
        <UpcomingList items={upcoming} />
      </div>
    </main>
  );
}
