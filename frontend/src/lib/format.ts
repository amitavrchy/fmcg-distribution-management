export const money = (minor: number, compact = false) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: 0,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(minor / 100);
export const number = (n: number) => new Intl.NumberFormat("en-BD").format(n);
export const date = (value: string, withTime = false) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
export const label = (v: string) =>
  v
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const initials = (s: string) =>
  s
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
export const due = (i: {
  totalMinor: number;
  paidMinor: number;
  creditedMinor?: number;
}) => Math.max(0, i.totalMinor - i.paidMinor - (i.creditedMinor || 0));
