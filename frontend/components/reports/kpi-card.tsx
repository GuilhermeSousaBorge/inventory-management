import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  label: string;
  value: ReactNode;
  subline?: string;
};

export function KpiCard({ label, value, subline }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {subline ? (
          <p className="mt-1 text-xs text-muted-foreground">{subline}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
