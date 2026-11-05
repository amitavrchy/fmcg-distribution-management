"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Package,
  Truck,
  ShieldAlert,
  Wallet,
  CheckCircle2,
  ClipboardCheck,
  Building2,
  TrendingUp,
} from "lucide-react";
import { useEnterprise } from "./provider";
import { useApp } from "../provider";
import { Badge, Panel } from "../ui";
import { Metrics, DataTable } from "./common";
import { money, date, label } from "@/lib/format";
export function ControlTower() {
  const { data: base } = useApp(),
    { data } = useEnterprise();
  const exceptions = [
    {
      title: "Credit approvals",
      count: base.orders.filter((o) => o.status === "PENDING_APPROVAL").length,
      detail: "Orders waiting for a credit decision",
      href: "/approvals",
      icon: Wallet,
      tone: "amber",
    },
    {
      title: "Expiry risk",
      count: data.expiry.length,
      detail: "Lots needing rotation or quality review",
      href: "/warehouses",
      icon: ShieldAlert,
      tone: "rose",
    },
    {
      title: "Field execution",
      count: data.summary.lateTasks,
      detail: "Assigned tasks past their due date",
      href: "/field",
      icon: ClipboardCheck,
      tone: "blue",
    },
    {
      title: "Customer refunds",
      count: data.returns.filter((r) => r.credit && !r.credit.refundPaid)
        .length,
      detail: "Received returns awaiting payout",
      href: "/returns",
      icon: Package,
      tone: "green",
    },
  ];
  const activity = [
    ...data.purchases.map((p) => ({
      id: p.id,
      title: p.number,
      detail: `${p.supplier.name} · ${p.status}`,
      at: p.createdAt,
      type: "PURCHASE",
    })),
    ...data.returns.map((r) => ({
      id: r.id,
      title: r.number,
      detail: `${r.order.outlet.name} · ${r.status}`,
      at: r.createdAt,
      type: "RETURN",
    })),
    ...data.journals.map((j) => ({
      id: j.id,
      title: j.reference,
      detail: j.description,
      at: j.createdAt,
      type: "JOURNAL",
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);
  return (
    <>
      <div className="control-hero">
        <div>
          <span className="eyebrow">DISTRIBUTION INTELLIGENCE</span>
          <h2>
            One operating picture.
            <br />
            <em>Every moving part.</em>
          </h2>
          <p>
            Connect stock, supply, field execution and settlement. Act on the
            exceptions that need your team today.
          </p>
          <div>
            <Link href="/approvals" className="button primary">
              Open approval inbox <ArrowRight size={17} />
            </Link>
            <Link href="/analytics" className="text-link">
              Explore planning insights <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div
          className="network-visual"
          aria-label="Connected distribution operations"
        >
          <span className="network-center">
            <Building2 size={35} />
            <b>Distribution hub</b>
          </span>
          <span className="network-node n1">
            <Package size={22} />
            Inventory
          </span>
          <span className="network-node n2">
            <Truck size={22} />
            Delivery
          </span>
          <span className="network-node n3">
            <ClipboardCheck size={22} />
            Field team
          </span>
          <span className="network-node n4">
            <Wallet size={22} />
            Settlement
          </span>
        </div>
      </div>
      <Metrics
        items={[
          {
            label: "Inventory cost value",
            value: money(data.summary.inventoryValueMinor),
            detail: `${data.warehouses.length} warehouse locations`,
          },
          {
            label: "Supply commitments",
            value: data.summary.openPurchaseCount,
            detail: "Open procurement workflows",
          },
          {
            label: "Trips in execution",
            value: data.summary.activeTrips,
            detail: `${data.vehicles.length} vehicles in your fleet`,
          },
          {
            label: "Open sales pipeline",
            value: money(data.summary.pipelineMinor),
            detail: `${data.summary.openTasks} field execution tasks`,
          },
        ]}
      />
      <div className="control-section-heading">
        <div>
          <h2>Exception radar</h2>
          <p>Prioritized signals from across your network.</p>
        </div>
        <span className="live-label">
          <i />
          Current workspace data
        </span>
      </div>
      <div className="exception-grid">
        {exceptions.map(({ title, count, detail, href, icon: Icon, tone }) => (
          <Link key={title} href={href} className={`exception-card ${tone}`}>
            <div>
              <span className="exception-icon">
                <Icon size={21} />
              </span>
              <ArrowUpRight size={18} />
            </div>
            <strong>{count}</strong>
            <h3>{title}</h3>
            <p>{detail}</p>
          </Link>
        ))}
      </div>
      <div className="control-bottom">
        <Panel
          title="Working capital snapshot"
          subtitle="Balances from actual business records"
        >
          <div className="working-capital">
            <div>
              <span>Customer receivables</span>
              <strong>{money(data.summary.receivableMinor)}</strong>
            </div>
            <div>
              <span>Supplier payables</span>
              <strong>{money(data.summary.payableMinor)}</strong>
            </div>
            <div>
              <span>Overdue customer balance</span>
              <strong className="warning">
                {money(data.summary.overdueMinor)}
              </strong>
            </div>
            <div>
              <span>Pending customer refunds</span>
              <strong>{money(data.summary.pendingRefundMinor)}</strong>
            </div>
          </div>
          <Link className="text-link control-panel-link" href="/finance">
            Open finance controls <ArrowRight size={16} />
          </Link>
        </Panel>
        <Panel
          title="Operational activity"
          subtitle="A chronological view of procurement, returns and financial posting"
        >
          <div className="activity-timeline">
            {activity.length ? (
              activity.map((a) => (
                <div key={a.id}>
                  <i />
                  <span>
                    <strong>{a.title}</strong>
                    <p>{a.detail}</p>
                  </span>
                  <time>{date(a.at, true)}</time>
                </div>
              ))
            ) : (
              <div className="enterprise-empty">
                Your first advanced operation will appear here.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
export function Approvals() {
  const { data, run, working } = useEnterprise(),
    { data: base, user, mutate } = useApp();
  const manager = ["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role);
  const items = [
    ...data.purchases
      .filter((p) => p.status === "DRAFT")
      .map((p) => ({
        id: p.id,
        type: "Purchase order",
        title: p.number,
        detail: p.supplier.name,
        value: money(p.lines.reduce((s, l) => s + l.qty * l.unitCostMinor, 0)),
        path: `purchases/${p.id}`,
        approved: "APPROVED",
        rejected: "CANCELLED",
        date: p.createdAt,
      })),
    ...data.returns
      .filter((r) => r.status === "REQUESTED")
      .map((r) => ({
        id: r.id,
        type: "Return authorization",
        title: r.number,
        detail: r.order.outlet.name,
        value: `${r.lines.reduce((s, l) => s + l.qty + l.freeQty, 0)} units`,
        path: `returns/${r.id}`,
        approved: "APPROVED",
        rejected: "REJECTED",
        date: r.createdAt,
      })),
    ...data.counts
      .filter((c) => c.status === "SUBMITTED")
      .map((c) => ({
        id: c.id,
        type: "Cycle count variance",
        title: c.number,
        detail: c.warehouse.name,
        value: `${c.lines.reduce((s, l) => s + l.countedQty - l.expectedQty, 0)} units variance`,
        path: `counts/${c.id}`,
        approved: "APPROVED",
        rejected: "REJECTED",
        date: c.createdAt,
      })),
    ...data.expenses
      .filter((e) => e.status === "SUBMITTED")
      .map((e) => ({
        id: e.id,
        type: "Expense approval",
        title: label(e.category),
        detail: e.description,
        value: money(e.amountMinor),
        path: `expenses/${e.id}`,
        approved: "APPROVED",
        rejected: "REJECTED",
        date: e.createdAt,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <Metrics
        items={[
          {
            label: "Approval queue",
            value: items.length,
            detail: "Purchases, returns, counts and expenses",
          },
          {
            label: "Credit decisions",
            value: base.orders.filter((o) => o.status === "PENDING_APPROVAL")
              .length,
            detail: "Sales orders requiring manager override",
          },
          {
            label: "In-transit stock",
            value: data.transfers
              .filter((t) => t.status === "IN_TRANSIT")
              .reduce((s, t) => s + t.qty, 0),
            detail: "Units awaiting warehouse receipt",
          },
          {
            label: "Cash handovers",
            value: data.handovers.filter((h) => h.status === "SUBMITTED")
              .length,
            detail: "Awaiting accounts acknowledgement",
          },
        ]}
      />
      <Panel
        title="Your decision inbox"
        subtitle="Review the original record before approving a financial or inventory effect"
      >
        <DataTable
          rows={items}
          columns={[
            {
              label: "Workflow",
              render: (i) => <Badge value={i.type.replaceAll(" ", "_")} />,
            },
            {
              label: "Record",
              render: (i) => (
                <>
                  <strong>{i.title}</strong>
                  <span className="cell-sub wrap-cell">{i.detail}</span>
                </>
              ),
            },
            { label: "Exposure", render: (i) => i.value },
            { label: "Waiting since", render: (i) => date(i.date, true) },
            {
              label: "Decision",
              render: (i) =>
                manager ? (
                  <div className="row-actions">
                    <button
                      className="button small primary"
                      disabled={working}
                      onClick={() =>
                        void run(i.path, { status: i.approved }, "PATCH")
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="button small danger"
                      disabled={working}
                      onClick={() =>
                        void run(i.path, { status: i.rejected }, "PATCH")
                      }
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span className="muted">Manager review required</span>
                ),
            },
          ]}
        />
      </Panel>
      {base.orders.some((o) => o.status === "PENDING_APPROVAL") && (
        <div className="approval-credit-banner">
          <Wallet size={22} />
          <div>
            <h3>Credit decisions require exposure review</h3>
            <p>
              Open the order detail to inspect its outlet and approve the credit
              exception.
            </p>
          </div>
          <Link className="button" href="/orders">
            Review credit orders <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </>
  );
}
