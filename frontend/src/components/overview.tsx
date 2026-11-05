"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Wallet,
  ShoppingBag,
  Store,
  Package,
  ArrowRight,
  CalendarDays,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Download,
} from "lucide-react";
import { useApp } from "./provider";
import { money, number, date } from "@/lib/format";
import { Panel, Badge, Progress } from "./ui";
import { SalesChart, Donut } from "./charts";
import { exportCsv } from "@/lib/export";
export function Overview({ newOrder }: { newOrder: () => void }) {
  const { data, user } = useApp(),
    [range, setRange] = useState(7);
  const sales = data.orders
    .filter((o) => o.status === "DELIVERED")
    .reduce((s, o) => s + (o.delivery?.invoice?.totalMinor || 0), 0);
  const collected = data.collections
    .filter((c) =>
      c.method !== "CHEQUE"
        ? c.status !== "BOUNCED"
        : c.status === "RECONCILED",
    )
    .reduce((s, c) => s + c.amountMinor, 0);
  const outstanding = data.invoices.reduce(
    (s, i) => s + i.totalMinor - i.paidMinor,
    0,
  );
  const low = data.stock.filter((s) => s.qty < s.sku.reorderLevel);
  const monthly = data.orders
    .filter(
      (o) =>
        o.status === "DELIVERED" &&
        o.delivery?.deliveredAt?.slice(0, 7) === data.today.slice(0, 7),
    )
    .reduce((s, o) => s + (o.delivery?.invoice?.totalMinor || 0), 0);
  const target = data.targets
    .filter((t) => t.periodYm === data.today.slice(0, 7))
    .reduce((s, t) => s + t.targetMinor, 0);
  const productive = data.visits.filter((v) =>
    ["ORDER", "PRODUCTIVE"].includes(v.callType),
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR DISTRIBUTION AT A GLANCE</div>
          <h1>
            Good {new Date().getHours() < 12 ? "morning" : "afternoon"},{" "}
            {user.fullName.split(" ")[0]} <span className="wave">✦</span>
          </h1>
          <p>Here’s what’s moving across your network today.</p>
        </div>
        <div className="heading-actions">
          <span className="date-chip">
            <CalendarDays size={17} />
            {date(data.today + "T00:00:00+06:00")}, {data.today.slice(0, 4)}
          </span>
          <button
            className="button"
            onClick={() =>
              exportCsv(
                "sales-report",
                data.orders.map((o) => ({
                  Order: o.number,
                  Outlet: o.outlet.name,
                  Status: o.status,
                  BDT: o.totalMinor / 100,
                })),
              )
            }
          >
            <Download size={16} />
            Export
          </button>
          <button className="button primary" onClick={newOrder}>
            + New order
          </button>
        </div>
      </div>
      <div className="overview-banner">
        <div className="banner-icon">
          <TrendingUp size={24} />
        </div>
        <div>
          <strong>Your network, moving together.</strong>
          <p>
            {data.outlets.length} outlets. {data.distributors.length}{" "}
            distribution partner. One connected view.
          </p>
        </div>
        <Link href="/beats">
          Explore today’s routes <ArrowUpRight size={18} />
        </Link>
        <span className="banner-orbit" />
      </div>
      <div className="stats-grid">
        {[
          {
            name: "Secondary sales",
            value: money(sales),
            detail: "Delivered invoice value",
            icon: Wallet,
            tone: "green",
          },
          {
            name: "Total orders",
            value: number(data.orders.length),
            detail: `${data.orders.filter((o) => o.status === "SUBMITTED").length} awaiting confirmation`,
            icon: ShoppingBag,
            tone: "blue",
          },
          {
            name: "Collections received",
            value: money(collected),
            detail: `${money(outstanding)} outstanding`,
            icon: CheckCircle2,
            tone: "purple",
          },
          {
            name: "Active outlets",
            value: number(data.outlets.length),
            detail: `Across ${data.beats.length} active beats`,
            icon: Store,
            tone: "orange",
          },
        ].map(({ name, value, detail, icon: Icon, tone }) => (
          <div className="stat-card" key={name}>
            <div className="stat-top">
              <span>{name}</span>
              <span className={`stat-icon ${tone}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong>{value}</strong>
            <p>
              <span className="tiny-dot" />
              {detail}
            </p>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <Panel
          title="Sales performance"
          subtitle="A closer look at your delivered secondary sales"
          action={
            <div className="segmented">
              {[7, 30].map((n) => (
                <button
                  key={n}
                  className={range === n ? "selected" : ""}
                  onClick={() => setRange(n)}
                >
                  {n} days
                </button>
              ))}
            </div>
          }
        >
          <div className="chart-total">
            <strong>{money(sales)}</strong>
            <span>Total delivered sales in this workspace</span>
          </div>
          <SalesChart orders={data.orders} days={range} />
        </Panel>
        <Panel
          title="Monthly target"
          subtitle={new Date(data.today + "T00:00:00+06:00").toLocaleDateString(
            "en-GB",
            { month: "long", year: "numeric", timeZone: "Asia/Dhaka" },
          )}
          action={<TargetIcon />}
        >
          <Donut value={monthly} total={target} />
          <div className="target-values">
            <div>
              <span>Achieved</span>
              <strong>{money(monthly)}</strong>
            </div>
            <div>
              <span>Target</span>
              <strong>{money(target)}</strong>
            </div>
          </div>
          <div className="target-note">
            <span className="tiny-dot" />
            {target
              ? `${money(Math.max(0, target - monthly))} to reach your monthly goal`
              : "Set a monthly target to track progress"}
          </div>
          <Link className="text-link centered" href="/targets">
            View targets & incentives <ArrowRight size={16} />
          </Link>
        </Panel>
      </div>
      <div className="bottom-grid">
        <Panel
          title="Recent orders"
          subtitle="The latest activity from your field team"
          action={
            <Link className="text-link" href="/orders">
              View all orders <ArrowRight size={16} />
            </Link>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order / outlet</th>
                  <th>Sales rep</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.slice(0, 5).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="table-title" href="/orders">
                        {o.number}
                      </Link>
                      <span className="cell-sub">{o.outlet.name}</span>
                    </td>
                    <td>{o.sr.fullName}</td>
                    <td className="numeric">{money(o.totalMinor)}</td>
                    <td>
                      <Badge value={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="right-stack">
          <Panel
            title="Today in the field"
            action={<MapPin size={19} className="muted" />}
          >
            <div className="field-numbers">
              <div>
                <strong>
                  {data.visits.filter((v) => v.checkInAt).length}
                  <span> / {data.visits.length}</span>
                </strong>
                <p>outlets visited</p>
              </div>
              <div className="field-percent">
                {data.visits.length
                  ? Math.round((productive / data.visits.length) * 100)
                  : 0}
                %<span>productive calls</span>
              </div>
            </div>
            <Progress
              value={
                data.visits.length
                  ? (data.visits.filter((v) => v.checkInAt).length /
                      data.visits.length) *
                    100
                  : 0
              }
            />
            <Link className="text-link" href="/beats">
              Open journey plan <ArrowRight size={16} />
            </Link>
          </Panel>
          <Link href="/inventory" className="stock-alert">
            <span className="alert-icon">
              <Package size={22} />
            </span>
            <div>
              <strong>{low.length} products running low</strong>
              <p>Keep your shelves ready for tomorrow.</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </>
  );
}
function TargetIcon() {
  return <span className="target-mark">◎</span>;
}
