"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = {
  data: { name: string; monthly: number }[];
  currency: string;
};

export function CostBar({ data, currency }: Props) {
  const height = Math.max(200, data.length * 36 + 40);
  return (
    <Card>
      <CardHeader>
        <CardTitle>By Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => Number(v).toFixed(0)} />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)} ${currency}/mo`} />
              <Bar dataKey="monthly" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
