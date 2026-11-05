"use client";
import { useState } from "react";
import {
  Plus,
  Warehouse,
  MapPin,
  ArrowLeftRight,
  ClipboardCheck,
  ShieldAlert,
  Boxes,
  Search,
} from "lucide-react";
import { useApp } from "../provider";
import { useEnterprise } from "./provider";
import { Badge, Field, Modal, Panel, SearchBox, SimpleForm } from "../ui";
import { Metrics, Tabs, DataTable, ExportButton, Actions } from "./common";
import { BusinessForm } from "./forms";
import { money, date, label } from "@/lib/format";
export function Warehouses() {
  const { user } = useApp(),
    { data, act, run, working } = useEnterprise(),
    [tab, setTab] = useState("batches"),
    [form, setForm] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [q, setQ] = useState(""),
    [warehouseId, setWarehouseId] = useState("ALL"),
    [countWarehouse, setCountWarehouse] = useState(
      data.warehouses[0]?.id || "",
    );
  const manager = ["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role),
    operator = manager || user.role === "DISTRIBUTOR",
    batch = data.batches.find((b) => b.id === selected);
  const batches = data.batches.filter(
    (b) =>
      (warehouseId === "ALL" || b.warehouseId === warehouseId) &&
      `${b.lot} ${b.sku.name} ${b.sku.code} ${b.sku.barcode || ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <Metrics
        items={[
          {
            label: "Inventory cost value",
            value: money(data.summary.inventoryValueMinor),
            detail: "Includes available and held physical stock",
          },
          {
            label: "Warehouses",
            value: data.warehouses.length,
            detail: "Multi-location distribution inventory",
          },
          {
            label: "Quality holds",
            value: data.summary.quarantinedUnits,
            tone: "amber",
            detail: "Quarantined, recalled or expired units",
          },
          {
            label: "Expiring lots",
            value: data.expiry.length,
            tone: "rose",
            detail: "Available lots expiring within 30 days",
          },
        ]}
      />
      <div className="enterprise-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            {
              id: "batches",
              label: "Batches & traceability",
              count: data.batches.length,
            },
            { id: "locations", label: "Locations" },
            {
              id: "transfers",
              label: "Transfers",
              count: data.transfers.filter((t) => t.status === "IN_TRANSIT")
                .length,
            },
            { id: "counts", label: "Cycle counts" },
          ]}
        />
        <Actions>
          {operator && (
            <button className="button" onClick={() => setForm("transfer")}>
              <ArrowLeftRight size={16} />
              Transfer
            </button>
          )}
          {manager && (
            <button
              className="button primary"
              onClick={() => setForm("warehouse")}
            >
              <Plus size={16} />
              Warehouse
            </button>
          )}
        </Actions>
      </div>
      {tab === "batches" && (
        <Panel>
          <div className="table-toolbar">
            <SearchBox
              value={q}
              onChange={setQ}
              placeholder="Search product, barcode or lot…"
            />
            <select
              aria-label="Warehouse filter"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="ALL">All warehouses</option>
              {data.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <ExportButton
              name="batch-register"
              rows={batches.map((b) => ({
                Product: b.sku.name,
                Lot: b.lot,
                Warehouse: b.warehouse.name,
                Quantity: b.qty,
                Expiry: b.expiresOn || "No expiry",
                Disposition: b.status,
                CostBDT: (b.qty * b.unitCostMinor) / 100,
              }))}
            />
          </div>
          <DataTable
            rows={batches}
            columns={[
              {
                label: "Product / lot",
                render: (b) => (
                  <>
                    <button
                      className="link-button"
                      onClick={() => setSelected(b.id)}
                    >
                      {b.sku.name}
                    </button>
                    <span className="cell-sub">
                      {b.lot} · {b.sku.code}
                    </span>
                  </>
                ),
              },
              { label: "Warehouse", render: (b) => b.warehouse.name },
              { label: "Quantity", render: (b) => <strong>{b.qty}</strong> },
              { label: "Unit cost", render: (b) => money(b.unitCostMinor) },
              {
                label: "Expiry",
                render: (b) =>
                  b.expiresOn ? (
                    <span
                      className={
                        new Date(b.expiresOn).getTime() - Date.now() <
                        30 * 86400000
                          ? "warning"
                          : ""
                      }
                    >
                      {date(b.expiresOn)}
                    </span>
                  ) : (
                    "Not tracked"
                  ),
              },
              {
                label: "Disposition",
                render: (b) => <Badge value={b.status} />,
              },
              {
                label: "Trace",
                render: (b) => (
                  <button
                    className="button small"
                    onClick={() => setSelected(b.id)}
                  >
                    View lot
                  </button>
                ),
              },
            ]}
          />
        </Panel>
      )}
      {tab === "locations" && (
        <div className="warehouse-grid">
          {data.warehouses.map((w) => {
            const lots = data.batches.filter((b) => b.warehouseId === w.id);
            return (
              <Panel key={w.id} className="warehouse-card">
                <div className="warehouse-card-top">
                  <span className="enterprise-icon">
                    <Warehouse size={26} />
                  </span>
                  <Badge value={w.active ? "ACTIVE" : "INACTIVE"} />
                </div>
                <h2>{w.name}</h2>
                <p>
                  {w.code} · {w.distributor.name}
                </p>
                <span className="warehouse-address">
                  <MapPin size={15} />
                  {w.address || "Distribution hub"} · {w.lat.toFixed(3)},{" "}
                  {w.lng.toFixed(3)}
                </span>
                <div className="warehouse-totals">
                  <div>
                    <strong>{lots.reduce((s, b) => s + b.qty, 0)}</strong>
                    <span>units on hand</span>
                  </div>
                  <div>
                    <strong>{lots.length}</strong>
                    <span>tracked lots</span>
                  </div>
                  <div>
                    <strong>
                      {money(
                        lots.reduce((s, b) => s + b.qty * b.unitCostMinor, 0),
                        true,
                      )}
                    </strong>
                    <span>inventory cost</span>
                  </div>
                </div>
                <button
                  className="text-link"
                  onClick={() => {
                    setWarehouseId(w.id);
                    setTab("batches");
                  }}
                >
                  Explore inventory →
                </button>
              </Panel>
            );
          })}
        </div>
      )}
      {tab === "transfers" && (
        <Panel
          title="Inter-warehouse movements"
          subtitle="Request → approve and dispatch → receive. In-transit stock is excluded from available-to-promise."
        >
          <DataTable
            rows={data.transfers}
            columns={[
              {
                label: "Transfer",
                render: (t) => (
                  <>
                    <strong>{t.number}</strong>
                    <span className="cell-sub">{date(t.createdAt)}</span>
                  </>
                ),
              },
              {
                label: "Product / lot",
                render: (t) => (
                  <>
                    {t.batch.sku.name}
                    <span className="cell-sub">{t.batch.lot}</span>
                  </>
                ),
              },
              {
                label: "From → to",
                render: (t) => (
                  <>
                    {t.batch.warehouse.name}
                    <span className="cell-sub">
                      →{" "}
                      {
                        data.warehouses.find(
                          (w) => w.id === t.targetWarehouseId,
                        )?.name
                      }
                    </span>
                  </>
                ),
              },
              { label: "Units", render: (t) => t.qty },
              { label: "Status", render: (t) => <Badge value={t.status} /> },
              {
                label: "Action",
                render: (t) => (
                  <div className="row-actions">
                    {t.status === "REQUESTED" && manager && (
                      <button
                        className="button small"
                        disabled={working}
                        onClick={() =>
                          void run(
                            `transfers/${t.id}`,
                            { status: "IN_TRANSIT" },
                            "PATCH",
                          )
                        }
                      >
                        Approve & dispatch
                      </button>
                    )}
                    {t.status === "IN_TRANSIT" && operator && (
                      <button
                        className="button small primary"
                        disabled={working}
                        onClick={() =>
                          void run(
                            `transfers/${t.id}`,
                            { status: "RECEIVED" },
                            "PATCH",
                          )
                        }
                      >
                        Receive stock
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Panel>
      )}
      {tab === "counts" && (
        <Panel
          title="Cycle counts & variance control"
          subtitle="Counts record a stock snapshot; approval rejects stale snapshots after inventory movement."
          action={
            operator && (
              <button
                className="button primary small"
                onClick={() => setForm("count")}
              >
                <ClipboardCheck size={16} />
                Start count
              </button>
            )
          }
        >
          <DataTable
            rows={data.counts}
            columns={[
              { label: "Count", render: (c) => <strong>{c.number}</strong> },
              { label: "Warehouse", render: (c) => c.warehouse.name },
              { label: "Counted lots", render: (c) => c.lines.length },
              {
                label: "Unit variance",
                render: (c) =>
                  c.lines.reduce((s, l) => s + l.countedQty - l.expectedQty, 0),
              },
              { label: "Status", render: (c) => <Badge value={c.status} /> },
              {
                label: "Review",
                render: (c) =>
                  c.status === "SUBMITTED" && manager ? (
                    <div className="row-actions">
                      <button
                        className="button small"
                        disabled={working}
                        onClick={() =>
                          void run(
                            `counts/${c.id}`,
                            { status: "APPROVED" },
                            "PATCH",
                          )
                        }
                      >
                        Approve adjustment
                      </button>
                      <button
                        className="button small danger"
                        disabled={working}
                        onClick={() =>
                          void run(
                            `counts/${c.id}`,
                            { status: "REJECTED" },
                            "PATCH",
                          )
                        }
                      >
                        Reject
                      </button>
                    </div>
                  ) : null,
              },
            ]}
          />
        </Panel>
      )}
      {batch && (
        <Modal
          title={`Trace lot · ${batch.lot}`}
          onClose={() => setSelected(null)}
        >
          <div className="detail-overview">
            <div>
              <h3>{batch.sku.name}</h3>
              <p>
                {batch.warehouse.name} · {batch.qty} physical units
              </p>
            </div>
            <Badge value={batch.status} />
          </div>
          <div className="trace-chain">
            <span>Received {date(batch.receivedAt)}</span>
            <b>→</b>
            <span>{batch.allocations.length} allocations</span>
            <b>→</b>
            <span>
              {
                new Set(
                  batch.allocations.map((a) => a.orderLine.order.outletId),
                ).size
              }{" "}
              outlets reached
            </span>
          </div>
          <DataTable
            rows={batch.allocations}
            empty="No customer allocations for this lot"
            columns={[
              { label: "Order", render: (a) => a.orderLine.order.number },
              {
                label: "Affected outlet",
                render: (a) => a.orderLine.order.outlet.name,
              },
              {
                label: "Paid / free",
                render: (a) => `${a.qty} / ${a.freeQty}`,
              },
              {
                label: "Order status",
                render: (a) => <Badge value={a.orderLine.order.status} />,
              },
            ]}
          />
          {manager && (
            <div className="form-footer">
              <button
                className="button danger"
                onClick={() => {
                  setForm(`batchStatus:${batch.id}`);
                  setSelected(null);
                }}
              >
                <ShieldAlert size={17} />
                Manage lot disposition
              </button>
            </div>
          )}
        </Modal>
      )}
      {form === "count" && (
        <Modal title="Submit physical stock count" onClose={() => setForm("")}>
          <SimpleForm
            submit="Submit for variance approval"
            onSubmit={async (f) => {
              const lines = data.batches
                .filter((b) => b.warehouseId === countWarehouse)
                .map((b) => ({
                  batchId: b.id,
                  countedQty: Number(f.get(b.id)),
                }));
              await act("counts", {
                warehouseId: countWarehouse,
                notes: f.get("notes"),
                lines,
              });
              setForm("");
            }}
          >
            <Field label="Warehouse">
              <select
                value={countWarehouse}
                onChange={(e) => setCountWarehouse(e.target.value)}
              >
                {data.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Count notes">
              <input name="notes" maxLength={500} />
            </Field>
            <div className="form-full">
              <DataTable
                rows={data.batches.filter(
                  (b) => b.warehouseId === countWarehouse,
                )}
                columns={[
                  {
                    label: "Product / lot",
                    render: (b) => (
                      <>
                        {b.sku.name}
                        <span className="cell-sub">{b.lot}</span>
                      </>
                    ),
                  },
                  { label: "System quantity", render: (b) => b.qty },
                  {
                    label: "Physical count",
                    render: (b) => (
                      <input
                        key={`${b.id}-${b.qty}`}
                        aria-label={`Count ${b.lot}`}
                        name={b.id}
                        type="number"
                        min="0"
                        max="1000000"
                        defaultValue={b.qty}
                        required
                        className="quantity-input"
                      />
                    ),
                  },
                ]}
              />
            </div>
          </SimpleForm>
        </Modal>
      )}
      {form && form !== "count" && (
        <BusinessForm
          mode={form.split(":")[0]}
          targetId={form.split(":")[1]}
          onClose={() => setForm("")}
        />
      )}
    </>
  );
}
