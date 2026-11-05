import { distanceMeters } from "./geo";
export const invoiceDue = (invoice: {
  totalMinor: number;
  paidMinor: number;
  creditedMinor?: number;
}) =>
  Math.max(
    0,
    invoice.totalMinor - invoice.paidMinor - (invoice.creditedMinor || 0),
  );
export type JournalLine = {
  account: string;
  debitMinor: number;
  creditMinor: number;
};
export function balanced(lines: JournalLine[]) {
  return (
    lines.length >= 2 &&
    lines.every(
      (l) =>
        Number.isSafeInteger(l.debitMinor) &&
        Number.isSafeInteger(l.creditMinor) &&
        l.debitMinor >= 0 &&
        l.creditMinor >= 0 &&
        !(l.debitMinor && l.creditMinor),
    ) &&
    lines.reduce((s, l) => s + l.debitMinor - l.creditMinor, 0) === 0
  );
}
export function aging(createdAt: Date, dueDays: number, now = new Date()) {
  const days = Math.max(
    0,
    Math.floor((now.getTime() - createdAt.getTime()) / 86400000) - dueDays,
  );
  return {
    days,
    bucket:
      days === 0
        ? "CURRENT"
        : days <= 30
          ? "1–30"
          : days <= 60
            ? "31–60"
            : days <= 90
              ? "61–90"
              : "90+",
  };
}
export function replenishment(
  sold: number,
  days: number,
  onHand: number,
  leadDays: number,
  safetyDays: number,
) {
  const daily = days > 0 ? sold / days : 0;
  return {
    dailyDemand: Math.round(daily * 100) / 100,
    daysCover: daily ? Math.floor(onHand / daily) : null,
    suggestedQty: Math.max(
      0,
      Math.ceil(daily * (leadDays + safetyDays) - onHand),
    ),
  };
}
export function abc<T extends { valueMinor: number }>(rows: T[]) {
  const sorted = [...rows].sort((a, b) => b.valueMinor - a.valueMinor),
    total = sorted.reduce((s, r) => s + r.valueMinor, 0);
  let sum = 0;
  return sorted.map((r) => {
    const before = total ? sum / total : 1;
    sum += r.valueMinor;
    return {
      ...r,
      classification: !r.valueMinor
        ? "C"
        : before < 0.8
          ? "A"
          : before < 0.95
            ? "B"
            : "C",
    };
  });
}
export function optimizeStops<
  T extends { id: string; lat: number; lng: number },
>(origin: { lat: number; lng: number }, stops: T[]) {
  let current = origin,
    distance = 0;
  const remaining = [...stops],
    ordered: T[] = [];
  while (remaining.length) {
    remaining.sort(
      (a, b) =>
        distanceMeters(current.lat, current.lng, a.lat, a.lng) -
          distanceMeters(current.lat, current.lng, b.lat, b.lng) ||
        a.id.localeCompare(b.id),
    );
    const next = remaining.shift()!;
    distance += distanceMeters(current.lat, current.lng, next.lat, next.lng);
    ordered.push(next);
    current = next;
  }
  if (stops.length)
    distance += distanceMeters(
      current.lat,
      current.lng,
      origin.lat,
      origin.lng,
    );
  return { stops: ordered, distanceKm: Math.round(distance / 100) / 10 };
}
