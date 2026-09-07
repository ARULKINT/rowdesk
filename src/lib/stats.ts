import "server-only";
import type { BarDatum } from "@/components/SimpleBarChart";

/** Buckets timestamps into daily counts for the trailing `numDays` days (oldest first). */
export function dailyCounts(dates: Date[], numDays: number): BarDatum[] {
  const buckets = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const order: string[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
    order.push(key);
  }

  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return order.map((key) => ({
    label: key.slice(5).replace("-", "/"),
    value: buckets.get(key) ?? 0,
  }));
}
