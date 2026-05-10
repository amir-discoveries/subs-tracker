import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = {
  currency: string;
  totalMonthly: number;
  totalYearly: number;
};

function fmt(n: number) {
  return n.toFixed(2);
}

export function TotalsCards({ currency, totalMonthly, totalYearly }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground font-medium">
            Total Monthly
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-heading tabular-nums">
            {fmt(totalMonthly)} <span className="text-2xl text-muted-foreground">{currency}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground font-medium">
            Total Yearly
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-heading tabular-nums">
            {fmt(totalYearly)} <span className="text-2xl text-muted-foreground">{currency}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
