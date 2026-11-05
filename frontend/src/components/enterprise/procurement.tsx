"use client";
import { useState } from "react";
import {
  Plus,
  Building2,
  ArrowRight,
  PackageCheck,
  CalendarDays,
  Truck,
} from "lucide-react";
import { useApp } from "../provider";
import { useEnterprise } from "./provider";
import { Badge, Modal, Panel, SearchBox } from "../ui";
import {
  Metrics,
  Tabs,
  DataTable,
  StateSteps,
  ExportButton,
  Actions,
} from "./common";
import { BusinessForm, PurchaseEditor, ReceiptEditor } from "./forms";
import { money, date, label } from "@/lib/format";
import type { Purchase } from "@/lib/enterprise";
export function Procurement() {
  const { user } = useApp(),
    { data, run, working } = useEnterprise(),
    [tab, setTab] = useState("board"),
    [q, setQ] = useState(""),
    [form, setForm] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const manager = ["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role),
    operator = manager || user.role === "DISTRIBUTOR",
    current = data.purchases.find((p) => p.id === selected);
  const purchases = data.purchases.filter((p) =>
    `${p.number} ${p.supplier.name}`.toLowerCase().includes(q.toLowerCase()),
  );
  const total = (p: Purchase) =>
    p.lines.reduce((s, l) => s + l.qty * l.unitCostMinor, 0) + p.freightMinor;
  return (
    <>
      <Metrics
        items={[
          {
            label: "Open purchase orders",
            value: data.summary.openPurchaseCount,
            detail: "Draft, approved and partially received",
          },
          {
            label: "Supplier balance",
            value: money(data.summary.payableMinor),
            tone: "amber",
            detail: "Posted receipts less payments",
          },
          {
            label: "Supply partners",
            value: data.suppliers.length,
            detail: "Approved supplier directory",
          },
          {
            label: "Goods receipts",
            value: data.purchases.reduce((s, p) => s + p.receipts.length, 0),
            detail: "Batch-tracked warehouse receipts",
          },
        ]}
      />
      <div className="enterprise-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            {
              id: "board",
              label: "Purchase pipeline",
              count: data.purchases.length,
            },
            {
              id: "suppliers",
              label: "Suppliers",
              count: data.suppliers.length,
            },
            { id: "receipts", label: "Goods receipts" },
          ]}
        />
        <Actions>
          {manager && (
            <button className="button" onClick={() => setForm("supplier")}>
              <Plus size={16} />
              Supplier
            </button>
          )}
          {operator && (
            <button
              className="button primary"
              onClick={() => setForm("purchase")}
            >
              <Plus size={16} />
              Purchase order
            </button>
          )}
        </Actions>
      </div>
      {tab === "board" && (
        <>
          <div className="enterprise-filter">
            <SearchBox
              value={q}
              onChange={setQ}
              placeholder="Find purchase order or supplier…"
            />
            <ExportButton
              name="purchase-orders"
              rows={purchases.map((p) => ({
                Order: p.number,
                Supplier: p.supplier.name,
                Status: p.status,
                GoodsAndFreightBDT: total(p) / 100,
              }))}
            />
          </div>
          <div className="kanban procurement-board">
            {[
              { id: "DRAFT", title: "Awaiting approval" },
              { id: "APPROVED", title: "Ready to receive" },
              { id: "PARTIAL", title: "Partially received" },
              { id: "RECEIVED", title: "Completed" },
            ].map((column) => (
              <section className="kanban-column" key={column.id}>
                <header>
                  <span className={`column-dot ${column.id.toLowerCase()}`} />
                  <h2>{column.title}</h2>
                  <b>
                    {purchases.filter((p) => p.status === column.id).length}
                  </b>
                </header>
                {purchases
                  .filter((p) => p.status === column.id)
                  .map((p) => (
                    <button
                      className="purchase-card"
                      onClick={() => setSelected(p.id)}
                      key={p.id}
                    >
                      <div>
                        <strong>{p.number}</strong>
                        <ArrowRight size={16} />
                      </div>
                      <h3>{p.supplier.name}</h3>
                      <p>
                        {p.lines.length} products · {p.distributor.name}
                      </p>
                      <strong className="card-amount">{money(total(p))}</strong>
                      <footer>
                        <span>
                          <CalendarDays size={14} />
                          {date(p.expectedOn)}
                        </span>
                        <span>
                          {p.lines.reduce((s, l) => s + l.receivedQty, 0)} /{" "}
                          {p.lines.reduce((s, l) => s + l.qty, 0)} units
                        </span>
                      </footer>
                    </button>
                  ))}
                {!purchases.some((p) => p.status === column.id) && (
                  <div className="kanban-placeholder">
                    No orders in this stage
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      {tab === "suppliers" && (
        <div className="supplier-grid">
          {data.suppliers.map((s) => (
            <Panel key={s.id} className="supplier-card">
              <div className="supplier-card-top">
                <span className="enterprise-icon">
                  <Building2 size={25} />
                </span>
                <Badge value={s.active ? "ACTIVE" : "INACTIVE"} />
              </div>
              <h2>{s.name}</h2>
              <p>
                {s.code} · {s.contact}
              </p>
              <dl>
                <div>
                  <dt>Payment terms</dt>
                  <dd>{s.paymentTermsDays} days</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>
                    <a href={`tel:${s.phone}`}>{s.phone}</a>
                  </dd>
                </div>
                <div>
                  <dt>Purchase orders</dt>
                  <dd>
                    {data.purchases.filter((p) => p.supplierId === s.id).length}
                  </dd>
                </div>
              </dl>
            </Panel>
          ))}
          {!data.suppliers.length && (
            <div className="enterprise-empty">
              Add a supply partner to begin procurement.
            </div>
          )}
        </div>
      )}
      {tab === "receipts" && (
        <Panel
          title="Goods received register"
          subtitle="Purchase-backed receipts with lot-level stock and payable posting"
        >
          <DataTable
            rows={data.purchases.flatMap((p) =>
              p.receipts.map((r) => ({
                ...r,
                purchase: p.number,
                supplier: p.supplier.name,
              })),
            )}
            columns={[
              { label: "Receipt", render: (r) => <strong>{r.number}</strong> },
              {
                label: "Purchase / supplier",
                render: (r) => (
                  <>
                    {r.purchase}
                    <span className="cell-sub">{r.supplier}</span>
                  </>
                ),
              },
              {
                label: "Units",
                render: (r) => r.lines.reduce((s, l) => s + l.qty, 0),
              },
              {
                label: "Posted value",
                render: (r) =>
                  money(r.lines.reduce((s, l) => s + l.costMinor, 0)),
              },
              { label: "Date", render: (r) => date(r.createdAt, true) },
            ]}
          />
        </Panel>
      )}
      {current && (
        <Modal title={current.number} onClose={() => setSelected(null)}>
          <StateSteps
            states={["DRAFT", "APPROVED", "PARTIAL", "RECEIVED"]}
            current={current.status}
          />
          <div className="detail-overview">
            <div>
              <h3>{current.supplier.name}</h3>
              <p>
                Expected {date(current.expectedOn)} · {current.distributor.name}
              </p>
            </div>
            <Badge value={current.status} />
          </div>
          <DataTable
            rows={current.lines}
            columns={[
              { label: "Product", render: (l) => l.sku.name },
              {
                label: "Ordered / received",
                render: (l) => `${l.qty} / ${l.receivedQty}`,
              },
              { label: "Unit cost", render: (l) => money(l.unitCostMinor) },
              {
                label: "Goods value",
                render: (l) => money(l.qty * l.unitCostMinor),
              },
            ]}
          />
          <div className="order-summary">
            <div>
              <span>Freight</span>
              <strong>{money(current.freightMinor)}</strong>
            </div>
            <div>
              <span>Purchase tax rate</span>
              <strong>{current.taxBps / 100}%</strong>
            </div>
            <div className="total">
              <span>Goods & freight</span>
              <strong>{money(total(current))}</strong>
            </div>
          </div>
          {current.notes && <p className="callout">{current.notes}</p>}
          <div className="form-footer">
            {current.status === "DRAFT" && manager && (
              <button
                className="button primary"
                disabled={working}
                onClick={() =>
                  void run(
                    `purchases/${current.id}`,
                    { status: "APPROVED" },
                    "PATCH",
                  )
                }
              >
                Approve purchase
              </button>
            )}
            {["APPROVED", "PARTIAL"].includes(current.status) && operator && (
              <button
                className="button primary"
                onClick={() => {
                  setSelected(null);
                  setForm(`receive:${current.id}`);
                }}
              >
                <PackageCheck size={17} />
                Receive goods
              </button>
            )}
            {["DRAFT", "APPROVED"].includes(current.status) && manager && (
              <button
                className="button danger"
                disabled={working}
                onClick={() =>
                  void run(
                    `purchases/${current.id}`,
                    { status: "CANCELLED" },
                    "PATCH",
                  )
                }
              >
                Cancel order
              </button>
            )}
          </div>
        </Modal>
      )}
      {form === "purchase" && <PurchaseEditor onClose={() => setForm("")} />}{" "}
      {form === "supplier" && (
        <BusinessForm mode="supplier" onClose={() => setForm("")} />
      )}{" "}
      {form.startsWith("receive:") &&
        data.purchases.find((p) => p.id === form.split(":")[1]) && (
          <ReceiptEditor
            purchase={data.purchases.find((p) => p.id === form.split(":")[1])!}
            onClose={() => setForm("")}
          />
        )}
    </>
  );
}
