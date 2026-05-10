import type { UpcomingItem } from "@/lib/data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = { items: UpcomingItem[] };

function whenPhrase(n: number) {
  if (n === 0) return "today";
  if (n === 1) return "in 1 day";
  return `in ${n} days`;
}

export function UpcomingList({ items }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming this week</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No renewals in the next 7 days.</p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={`${it.name}-${it.date}`} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {it.date} ({whenPhrase(it.daysUntil)})
                  </div>
                </div>
                <div className="tabular-nums text-sm">
                  {it.cost.toFixed(2)} {it.currency}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
