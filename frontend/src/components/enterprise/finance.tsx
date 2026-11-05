"use client";
import { useState } from "react";
import { Plus, Wallet, Printer, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useApp } from "../provider";
import { useEnterprise } from "./provider";
import { Badge, Modal, Panel, Field, SimpleForm } from "../ui";
import { Metrics, Tabs, DataTable, ExportButton, Actions } from "./common";
import { BusinessForm } from "./forms";
import { money, date, label } from "@/lib/format";
export function Finance() {
  const { user, data: base } = useApp(),
    { data, run, working } = useEnterprise(),
    [tab, setTab] = useState("receivables"),
    [form, setForm] = useState(""),
    [outletId, setOutlet] = useState("ALL"),
    [journalId, setJournal] = useState<string | null>(null);
  const manager = ["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role),
    account = manager || user.role === "ACCOUNTS",
    rows = data.aging.filter(
      (r) => outletId === "ALL" || r.outletId === outletId,
    );
  const buckets = ["CURRENT", "1–30", "31–60", "61–90", "90+"].map(
      (bucket) => ({
        bucket,
        value: rows
          .filter((r) => r.bucket === bucket)
          .reduce((s, r) => s + r.outstandingMinor, 0),
      }),
    ),
    max = Math.max(...buckets.map((b) => b.value), 1),
    journal = data.journals.find((j) => j.id === journalId);
  const debit = data.trialBalance.reduce((s, l) => s + l.debitMinor, 0),
    credit = data.trialBalance.reduce((s, l) => s + l.creditMinor, 0);
  return (
    <>
      <Metrics
        items={[
          {
            label: "Customer receivables",
            value: money(data.summary.receivableMinor),
            detail: "Unpaid invoices after applied credits",
          },
          {
            label: "Overdue exposure",
            value: money(data.summary.overdueMinor),
            tone: "rose",
            detail: "Based on outlet-specific payment terms",
          },
          {
            label: "Supplier payables",
            value: money(data.summary.payableMinor),
            detail: "Goods received less supplier payments",
          },
          {
            label: "Refunds to settle",
            value: money(data.summary.pendingRefundMinor),
            tone: "amber",
            detail: "Approved, physically received returns",
          },
        ]}
      />
      <div className="enterprise-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "receivables", label: "Receivables & aging" },
            { id: "payables", label: "Payables" },
            { id: "ledger", label: "General ledger" },
            { id: "expenses", label: "Expenses" },
            { id: "cash", label: "Cash handover" },
          ]}
        />
        <Actions>
          <button className="button" onClick={() => window.print()}>
            <Printer size={16} />
            Print report
          </button>
          <button className="button primary" onClick={() => setForm("expense")}>
            <Plus size={16} />
            Expense
          </button>
        </Actions>
      </div>
      {tab === "receivables" && (
        <div className="finance-aging-layout">
          <Panel
            title="Receivables aging"
            subtitle="A payment-terms based view of collection risk"
          >
            <div className="aging-bars">
              {buckets.map((b, i) => (
                <div key={b.bucket}>
                  <div>
                    <span>
                      {b.bucket === "CURRENT"
                        ? "Within terms"
                        : `${b.bucket} days overdue`}
                    </span>
                    <strong>{money(b.value)}</strong>
                  </div>
                  <div className="aging-track">
                    <span
                      style={{
                        width: `${(b.value / max) * 100}%`,
                        background: [
                          "#5b8060",
                          "#b2bd6c",
                          "#d0ae65",
                          "#cb8c66",
                          "#b66764",
                        ][i],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Customer statement"
            subtitle="Outstanding invoice register with aging buckets"
          >
            <div className="table-toolbar">
              <select
                aria-label="Customer statement outlet"
                value={outletId}
                onChange={(e) => setOutlet(e.target.value)}
              >
                <option value="ALL">All outlets</option>
                {base.outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <ExportButton
                name="receivables-statement"
                rows={rows.map((r) => ({
                  Invoice: r.number,
                  Outlet: r.outletName,
                  OutstandingBDT: r.outstandingMinor / 100,
                  DaysOverdue: r.days,
                  Bucket: r.bucket,
                }))}
              />
            </div>
            <DataTable
              rows={rows}
              columns={[
                {
                  label: "Invoice / outlet",
                  render: (r) => (
                    <>
                      <strong>{r.number}</strong>
                      <span className="cell-sub">{r.outletName}</span>
                    </>
                  ),
                },
                { label: "Invoice date", render: (r) => date(r.createdAt) },
                {
                  label: "Balance",
                  render: (r) => <strong>{money(r.outstandingMinor)}</strong>,
                },
                {
                  label: "Age",
                  render: (r) => (
                    <Badge value={r.days ? "OVERDUE" : "CURRENT"} />
                  ),
                },
              ]}
            />
          </Panel>
        </div>
      )}
      {tab === "payables" && (
        <Panel
          title="Supplier settlement register"
          subtitle="Partial receipts create actual liabilities; payments cannot exceed the open balance"
        >
          <DataTable
            rows={data.payables}
            columns={[
              {
                label: "Supplier / purchase",
                render: (p) => (
                  <>
                    <strong>{p.purchase.supplier.name}</strong>
                    <span className="cell-sub">{p.purchase.number}</span>
                  </>
                ),
              },
              { label: "Received value", render: (p) => money(p.totalMinor) },
              { label: "Paid", render: (p) => money(p.paidMinor) },
              {
                label: "Balance",
                render: (p) => (
                  <strong>{money(p.totalMinor - p.paidMinor)}</strong>
                ),
              },
              {
                label: "Due date",
                render: (p) => (
                  <span
                    className={
                      new Date(p.dueOn) < new Date() &&
                      p.totalMinor > p.paidMinor
                        ? "warning"
                        : ""
                    }
                  >
                    {date(p.dueOn)}
                  </span>
                ),
              },
              {
                label: "Settle",
                render: (p) =>
                  account && p.totalMinor > p.paidMinor ? (
                    <button
                      className="button small"
                      onClick={() => setForm(`supplierPay:${p.id}`)}
                    >
                      Record payment
                    </button>
                  ) : (
                    <Badge value="PAID" />
                  ),
              },
            ]}
          />
        </Panel>
      )}
      {tab === "ledger" && (
        <>
          <div
            className={`ledger-integrity ${debit === credit ? "balanced" : "warning"}`}
          >
            <ShieldCheck size={22} />
            <div>
              <strong>
                {debit === credit
                  ? "Trial balance is balanced"
                  : "Trial balance needs investigation"}
              </strong>
              <p>
                Debits {money(debit)} · Credits {money(credit)} · Difference{" "}
                {money(Math.abs(debit - credit))}
              </p>
            </div>
            <ExportButton
              name="trial-balance"
              rows={data.trialBalance.map((l) => ({
                Account: l.account,
                DebitBDT: l.debitMinor / 100,
                CreditBDT: l.creditMinor / 100,
                BalanceBDT: l.balanceMinor / 100,
              }))}
            />
          </div>
          <div className="ledger-grid">
            <Panel title="Trial balance">
              <DataTable
                rows={data.trialBalance}
                columns={[
                  { label: "Account", render: (l) => label(l.account) },
                  {
                    label: "Debit turnover",
                    render: (l) => money(l.debitMinor),
                  },
                  {
                    label: "Credit turnover",
                    render: (l) => money(l.creditMinor),
                  },
                  {
                    label: "Net balance",
                    render: (l) => <strong>{money(l.balanceMinor)}</strong>,
                  },
                ]}
              />
            </Panel>
            <Panel
              title="Journal activity"
              subtitle="Latest 200 immutable posting references"
            >
              <DataTable
                rows={data.journals}
                columns={[
                  {
                    label: "Reference",
                    render: (j) => (
                      <button
                        className="link-button"
                        onClick={() => setJournal(j.id)}
                      >
                        {j.reference}
                      </button>
                    ),
                  },
                  {
                    label: "Description",
                    render: (j) => (
                      <span className="wrap-cell">{j.description}</span>
                    ),
                  },
                  { label: "Posted", render: (j) => date(j.createdAt, true) },
                ]}
              />
            </Panel>
          </div>
        </>
      )}
      {tab === "expenses" && (
        <Panel
          title="Expense controls"
          subtitle="Submission, manager review, liability posting and payment"
        >
          <DataTable
            rows={data.expenses}
            columns={[
              {
                label: "Expense",
                render: (e) => (
                  <>
                    <strong>{label(e.category)}</strong>
                    <span className="cell-sub wrap-cell">{e.description}</span>
                  </>
                ),
              },
              { label: "Receipt", render: (e) => e.receiptReference },
              { label: "Amount", render: (e) => money(e.amountMinor) },
              { label: "Status", render: (e) => <Badge value={e.status} /> },
              {
                label: "Action",
                render: (e) => (
                  <div className="row-actions">
                    {manager && e.status === "SUBMITTED" && (
                      <>
                        <button
                          className="button small"
                          disabled={working}
                          onClick={() =>
                            void run(
                              `expenses/${e.id}`,
                              { status: "APPROVED" },
                              "PATCH",
                            )
                          }
                        >
                          Approve
                        </button>
                        <button
                          className="button small danger"
                          disabled={working}
                          onClick={() =>
                            void run(
                              `expenses/${e.id}`,
                              { status: "REJECTED" },
                              "PATCH",
                            )
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {account && e.status === "APPROVED" && (
                      <button
                        className="button small"
                        onClick={() => setForm(`expensePay:${e.id}`)}
                      >
                        Pay expense
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Panel>
      )}
      {tab === "cash" && (
        <Panel
          title="Field cash settlement"
          subtitle="System collection totals versus declared cash, with variance accountability"
          action={
            ["SR", "COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role) && (
              <button
                className="button primary small"
                onClick={() => setForm("handover")}
              >
                <Wallet size={16} />
                Submit handover
              </button>
            )
          }
        >
          <DataTable
            rows={data.handovers}
            columns={[
              {
                label: "Sales rep / day",
                render: (h) => (
                  <>
                    <strong>
                      {base.users.find((u) => u.id === h.srId)?.fullName ||
                        "Sales representative"}
                    </strong>
                    <span className="cell-sub">{h.businessDate}</span>
                  </>
                ),
              },
              { label: "Expected", render: (h) => money(h.expectedMinor) },
              { label: "Declared", render: (h) => money(h.declaredMinor) },
              {
                label: "Variance",
                render: (h) => (
                  <span
                    className={
                      h.expectedMinor !== h.declaredMinor ? "warning" : ""
                    }
                  >
                    {money(h.declaredMinor - h.expectedMinor)}
                    {h.discrepancyReason && (
                      <span className="cell-sub wrap-cell">
                        {h.discrepancyReason}
                      </span>
                    )}
                  </span>
                ),
              },
              { label: "Status", render: (h) => <Badge value={h.status} /> },
              {
                label: "Receive",
                render: (h) =>
                  account && h.status === "SUBMITTED" ? (
                    <button
                      className="button small"
                      disabled={working}
                      onClick={() => void run(`handovers/${h.id}/receive`, {})}
                    >
                      Acknowledge cash
                    </button>
                  ) : null,
              },
            ]}
          />
        </Panel>
      )}
      {journal && (
        <Modal title={journal.reference} onClose={() => setJournal(null)}>
          <p className="modal-description">
            {journal.description} · {date(journal.createdAt, true)}
          </p>
          <DataTable
            rows={journal.lines}
            columns={[
              { label: "Account", render: (l) => label(l.account) },
              { label: "Debit", render: (l) => money(l.debitMinor) },
              { label: "Credit", render: (l) => money(l.creditMinor) },
            ]}
          />
        </Modal>
      )}
      {form && (
        <BusinessForm
          mode={form.split(":")[0]}
          targetId={form.split(":")[1]}
          onClose={() => setForm("")}
        />
      )}
    </>
  );
}
