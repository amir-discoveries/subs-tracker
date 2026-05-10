import type { Subscription } from "@/lib/data";
import { removeSubscription } from "@/app/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = { subs: Subscription[] };

export function SubscriptionsTable({ subs }: Props) {
  const sorted = [...subs].sort((a, b) => b.cost - a.cost);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriptions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium text-right">Cost</th>
                <th className="py-2 pr-4 font-medium">Currency</th>
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 pr-4 font-medium text-right">Renews</th>
                <th className="py-2 pr-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((s) => (
                <tr key={s.name}>
                  <td className="py-2 pr-4 font-medium">{s.name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{s.cost.toFixed(2)}</td>
                  <td className="py-2 pr-4">{s.currency}</td>
                  <td className="py-2 pr-4">{s.category}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">day {s.renewalDay}</td>
                  <td className="py-2 pr-2 text-right">
                    <form action={removeSubscription}>
                      <input type="hidden" name="name" value={s.name} />
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
