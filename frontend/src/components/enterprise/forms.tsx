"use client";
import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "../provider";
import { useEnterprise } from "./provider";
import { Field, Modal, SimpleForm } from "../ui";
import { money } from "@/lib/format";
import type { Purchase, Trip } from "@/lib/enterprise";
type Choice = { value: string; label: string };
type Definition = {
  key: string;
  label: string;
  type?: string;
  options?: Choice[];
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: string;
};
const iso = (value: FormDataEntryValue | null) =>
  new Date(`${value}T12:00:00+06:00`).toISOString();
export function BusinessForm({
  mode,
  onClose,
  targetId,
  initial = {},
}: {
  mode: string;
  onClose: () => void;
  targetId?: string;
  initial?: Record<string, string | number>;
}) {
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const { data: base, user } = useApp(),
    { data, act } = useEnterprise();
  const options = (rows: { id: string; name: string }[]) =>
    rows.map((r) => ({ value: r.id, label: r.name }));
  const distributor: Definition = {
    key: "distributorId",
    label: "Distribution partner",
    options: options(base.distributors),
  };
  const definitions: Record<string, { title: string; fields: Definition[] }> = {
    warehouse: {
      title: "Add warehouse",
      fields: [
        { key: "name", label: "Warehouse name" },
        { key: "code", label: "Unique warehouse code" },
        distributor,
        { key: "address", label: "Address" },
        {
          key: "lat",
          label: "Latitude",
          type: "number",
          defaultValue: 23.806,
          min: -90,
          max: 90,
          step: "any",
        },
        {
          key: "lng",
          label: "Longitude",
          type: "number",
          defaultValue: 90.368,
          min: -180,
          max: 180,
          step: "any",
        },
      ],
    },
    supplier: {
      title: "Add supply partner",
      fields: [
        { key: "name", label: "Company name" },
        { key: "code", label: "Supplier code" },
        { key: "contact", label: "Contact person" },
        { key: "phone", label: "Phone" },
        {
          key: "email",
          label: "Email address",
          type: "email",
          required: false,
        },
        {
          key: "paymentTermsDays",
          label: "Payment terms (days)",
          type: "number",
          defaultValue: 30,
          min: 0,
          max: 365,
        },
      ],
    },
    vehicle: {
      title: "Add delivery vehicle",
      fields: [
        { key: "name", label: "Vehicle name" },
        { key: "registration", label: "Registration number" },
        distributor,
        {
          key: "capacityKg",
          label: "Payload capacity (kg)",
          type: "number",
          min: 1,
          max: 100000,
          defaultValue: 1000,
        },
      ],
    },
    expense: {
      title: "Submit expense",
      fields: [
        distributor,
        {
          key: "category",
          label: "Category",
          options: [
            "FUEL",
            "TRAVEL",
            "WAREHOUSE",
            "UTILITIES",
            "MARKETING",
            "OTHER",
          ].map((value) => ({ value, label: value })),
        },
        {
          key: "amount",
          label: "Amount (BDT)",
          type: "number",
          min: 0.01,
          max: 20000000,
          step: ".01",
        },
        {
          key: "description",
          label: "Business purpose (10+ characters)",
          type: "textarea",
        },
        { key: "receiptReference", label: "Receipt / evidence reference" },
      ],
    },
    handover: {
      title: "Close your cash day",
      fields: [
        distributor,
        {
          key: "businessDate",
          label: "Collection business date",
          type: "date",
          defaultValue: base.today,
        },
        {
          key: "declared",
          label: "Cash handed over (BDT)",
          type: "number",
          min: 0,
          max: 20000000,
          step: ".01",
        },
        {
          key: "discrepancyReason",
          label: "Explain any variance (10+ characters)",
          type: "textarea",
          required: false,
        },
      ],
    },
    task: {
      title: "Assign field execution task",
      fields: [
        { key: "title", label: "Task title" },
        {
          key: "type",
          label: "Task type",
          options: [
            "MERCHANDISING",
            "PRICE_AUDIT",
            "COMPETITOR",
            "ASSORTMENT",
            "FOLLOW_UP",
          ].map((value) => ({ value, label: value.replaceAll("_", " ") })),
        },
        { key: "outletId", label: "Outlet", options: options(base.outlets) },
        {
          key: "assignedTo",
          label: "Sales representative",
          options: base.users
            .filter((u) => u.role === "SR")
            .map((u) => ({ value: u.id, label: u.fullName })),
        },
        {
          key: "dueOn",
          label: "Due date",
          type: "date",
          defaultValue: base.today,
        },
        {
          key: "priority",
          label: "Priority",
          options: ["NORMAL", "HIGH", "URGENT"].map((value) => ({
            value,
            label: value,
          })),
        },
        {
          key: "checklist",
          label: "Checklist (one item per line)",
          type: "textarea",
          defaultValue:
            "Verify shelf availability\nRecord competitor activity\nConfirm next order date",
        },
      ],
    },
    opportunity: {
      title: "Add sales opportunity",
      fields: [
        { key: "title", label: "Opportunity title" },
        { key: "outletId", label: "Outlet", options: options(base.outlets) },
        {
          key: "value",
          label: "Potential value (BDT)",
          type: "number",
          min: 0.01,
          max: 20000000,
          step: ".01",
        },
        {
          key: "expectedOn",
          label: "Expected close date",
          type: "date",
          defaultValue: base.today,
        },
        {
          key: "notes",
          label: "Next steps / notes",
          type: "textarea",
          required: false,
        },
      ],
    },
    transfer: {
      title: "Request warehouse transfer",
      fields: [
        {
          key: "batchId",
          label: "Source batch",
          options: data.batches
            .filter((b) => b.status === "AVAILABLE" && b.qty > 0)
            .map((b) => ({
              value: b.id,
              label: `${b.sku.name} · ${b.lot} · ${b.warehouse.name} (${b.qty})`,
            })),
        },
        {
          key: "targetWarehouseId",
          label: "Destination warehouse",
          options: options(data.warehouses),
        },
        {
          key: "qty",
          label: "Transfer quantity",
          type: "number",
          min: 1,
          max: 100000,
        },
      ],
    },
    supplierPay: {
      title: "Record supplier payment",
      fields: [
        {
          key: "amount",
          label: "Payment (BDT)",
          type: "number",
          min: 0.01,
          max: 20000000,
          step: ".01",
        },
        {
          key: "method",
          label: "Payment account",
          options: ["BANK", "CASH", "BKASH", "NAGAD"].map((value) => ({
            value,
            label: value,
          })),
        },
        { key: "reference", label: "Payment reference" },
      ],
    },
    refund: {
      title: "Pay customer refund",
      fields: [
        {
          key: "method",
          label: "Payment account",
          options: ["BANK", "CASH", "BKASH", "NAGAD"].map((value) => ({
            value,
            label: value,
          })),
        },
        { key: "reference", label: "Refund payment reference" },
      ],
    },
    expensePay: {
      title: "Pay approved expense",
      fields: [
        {
          key: "method",
          label: "Payment account",
          options: ["BANK", "CASH", "BKASH", "NAGAD"].map((value) => ({
            value,
            label: value,
          })),
        },
        { key: "reference", label: "Payment reference" },
      ],
    },
    batchStatus: {
      title: "Change lot disposition",
      fields: [
        {
          key: "status",
          label: "Disposition",
          options: ["QUARANTINED", "RECALLED", "EXPIRED", "AVAILABLE"].map(
            (value) => ({ value, label: value }),
          ),
        },
        { key: "reason", label: "Reason (10+ characters)", type: "textarea" },
      ],
    },
    proof: {
      title: "Record delivery outcome",
      fields: [
        {
          key: "status",
          label: "Outcome",
          options: [
            { value: "DELIVERED", label: "Delivered with proof" },
            { value: "FAILED", label: "Delivery failed" },
          ],
        },
        { key: "recipientName", label: "Recipient name", required: false },
        {
          key: "proofReference",
          label: "Signed challan / proof reference",
          required: false,
        },
        {
          key: "note",
          label: "Notes / failure reason (10+ characters)",
          type: "textarea",
          required: false,
        },
        {
          key: "lat",
          label: "Delivery latitude (optional)",
          type: "number",
          required: false,
          min: -90,
          max: 90,
          step: "any",
        },
        {
          key: "lng",
          label: "Delivery longitude (optional)",
          type: "number",
          required: false,
          min: -180,
          max: 180,
          step: "any",
        },
      ],
    },
  };
  const def = definitions[mode];
  if (!def) return null;
  return (
    <Modal title={def.title} onClose={onClose}>
      <SimpleForm
        onSubmit={async (f) => {
          let path = "",
            method = "POST",
            body: unknown = Object.fromEntries(f.entries());
          if (mode === "warehouse") {
            path = "warehouses";
            body = {
              ...Object.fromEntries(f),
              lat: Number(f.get("lat")),
              lng: Number(f.get("lng")),
            };
          }
          if (mode === "supplier") {
            path = "suppliers";
            body = {
              ...Object.fromEntries(f),
              paymentTermsDays: Number(f.get("paymentTermsDays")),
            };
          }
          if (mode === "vehicle") {
            path = "vehicles";
            body = {
              ...Object.fromEntries(f),
              capacityKg: Number(f.get("capacityKg")),
            };
          }
          if (mode === "expense") {
            path = "expenses";
            body = {
              distributorId: f.get("distributorId"),
              category: f.get("category"),
              amountMinor: Math.round(Number(f.get("amount")) * 100),
              description: f.get("description"),
              receiptReference: f.get("receiptReference"),
            };
          }
          if (mode === "handover") {
            path = "handovers";
            body = {
              distributorId: f.get("distributorId"),
              businessDate: f.get("businessDate"),
              declaredMinor: Math.round(Number(f.get("declared")) * 100),
              discrepancyReason: f.get("discrepancyReason"),
            };
          }
          if (mode === "task") {
            path = "tasks";
            body = {
              ...Object.fromEntries(f),
              dueOn: iso(f.get("dueOn")),
              checklist: String(f.get("checklist"))
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            };
          }
          if (mode === "opportunity") {
            path = "opportunities";
            body = {
              title: f.get("title"),
              outletId: f.get("outletId"),
              valueMinor: Math.round(Number(f.get("value")) * 100),
              expectedOn: iso(f.get("expectedOn")),
              notes: f.get("notes"),
            };
          }
          if (mode === "transfer") {
            path = "transfers";
            body = {
              ...Object.fromEntries(f),
              clientId,
              qty: Number(f.get("qty")),
            };
          }
          if (mode === "supplierPay") {
            path = `payables/${targetId}/pay`;
            body = {
              clientId,
              amountMinor: Math.round(Number(f.get("amount")) * 100),
              method: f.get("method"),
              reference: f.get("reference"),
            };
          }
          if (mode === "refund") path = `credits/${targetId}/refund`;
          if (mode === "expensePay") path = `expenses/${targetId}/pay`;
          if (mode === "batchStatus") {
            path = `batches/${targetId}`;
            method = "PATCH";
          }
          if (mode === "proof") {
            path = `stops/${targetId}`;
            method = "PATCH";
            body = {
              ...Object.fromEntries(f),
              ...(f.get("lat")
                ? { lat: Number(f.get("lat")) }
                : { lat: undefined }),
              ...(f.get("lng")
                ? { lng: Number(f.get("lng")) }
                : { lng: undefined }),
            };
          }
          await act(path, body, method);
          onClose();
        }}
      >
        {def.fields.map((field) => (
          <Field key={field.key} label={field.label}>
            {field.options ? (
              <select
                name={field.key}
                required={field.required !== false}
                defaultValue={initial[field.key] ?? field.defaultValue}
              >
                <option value="">Choose…</option>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                name={field.key}
                required={field.required !== false}
                defaultValue={initial[field.key] ?? field.defaultValue}
                maxLength={1000}
              />
            ) : (
              <input
                name={field.key}
                type={field.type || "text"}
                required={field.required !== false}
                defaultValue={initial[field.key] ?? field.defaultValue}
                min={field.min}
                max={field.max}
                step={field.step}
                maxLength={300}
              />
            )}
          </Field>
        ))}
      </SimpleForm>
    </Modal>
  );
}
export function PurchaseEditor({
  onClose,
  skuId,
}: {
  onClose: () => void;
  skuId?: string;
}) {
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const { data: base } = useApp(),
    { data, act } = useEnterprise(),
    [lines, setLines] = useState([
      { skuId: skuId || base.skus[0]?.id || "", qty: 12, unitCostMinor: 0 },
    ]);
  return (
    <Modal title="Create purchase order" onClose={onClose}>
      <SimpleForm
        submit="Save purchase draft"
        onSubmit={async (f) => {
          if (lines.some((l) => !l.unitCostMinor))
            throw new Error("Enter a positive purchase cost for every item");
          await act("purchases", {
            clientId,
            supplierId: f.get("supplierId"),
            distributorId: f.get("distributorId"),
            expectedOn: iso(f.get("expectedOn")),
            freightMinor: Math.round(Number(f.get("freight")) * 100),
            taxBps: Math.round(Number(f.get("tax")) * 100),
            notes: f.get("notes"),
            lines,
          });
          onClose();
        }}
      >
        <Field label="Supplier">
          <select name="supplierId" required>
            <option value="">Choose supplier</option>
            {data.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Distribution partner">
          <select name="distributorId" required>
            {base.distributors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expected receipt date">
          <input
            type="date"
            name="expectedOn"
            defaultValue={base.today}
            required
          />
        </Field>
        <Field label="Freight / landed cost (BDT)">
          <input
            type="number"
            min="0"
            step=".01"
            name="freight"
            defaultValue="0"
            required
          />
        </Field>
        <Field label="Purchase tax (%)">
          <input
            type="number"
            min="0"
            max="100"
            step=".01"
            name="tax"
            defaultValue="0"
            required
          />
        </Field>
        <Field label="Notes">
          <input name="notes" maxLength={500} />
        </Field>
        <div className="purchase-lines form-full">
          <h3>Purchase items</h3>
          {lines.map((l, i) => (
            <div className="purchase-item" key={i}>
              <Field label="Product">
                <select
                  value={l.skuId}
                  onChange={(e) =>
                    setLines(
                      lines.map((v, j) =>
                        i === j ? { ...v, skuId: e.target.value } : v,
                      ),
                    )
                  }
                >
                  {base.skus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Units">
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={l.qty}
                  onChange={(e) =>
                    setLines(
                      lines.map((v, j) =>
                        i === j ? { ...v, qty: Number(e.target.value) } : v,
                      ),
                    )
                  }
                  required
                />
              </Field>
              <Field label="Unit cost (BDT)">
                <input
                  type="number"
                  min=".01"
                  step=".01"
                  max="20000000"
                  value={l.unitCostMinor / 100 || ""}
                  onChange={(e) =>
                    setLines(
                      lines.map((v, j) =>
                        i === j
                          ? {
                              ...v,
                              unitCostMinor: Math.round(
                                Number(e.target.value) * 100,
                              ),
                            }
                          : v,
                      ),
                    )
                  }
                  required
                />
              </Field>
              <button
                type="button"
                className="icon-button"
                aria-label="Remove purchase line"
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button small"
            onClick={() =>
              setLines([
                ...lines,
                {
                  skuId:
                    base.skus.find((s) => !lines.some((l) => l.skuId === s.id))
                      ?.id || "",
                  qty: 12,
                  unitCostMinor: 0,
                },
              ])
            }
            disabled={lines.length >= base.skus.length}
          >
            <Plus size={16} />
            Add item
          </button>
          <strong className="purchase-total">
            Goods subtotal{" "}
            {money(lines.reduce((s, l) => s + l.qty * l.unitCostMinor, 0))}
          </strong>
        </div>
      </SimpleForm>
    </Modal>
  );
}
export function ReceiptEditor({
  purchase,
  onClose,
}: {
  purchase: Purchase;
  onClose: () => void;
}) {
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const { data, act } = useEnterprise(),
    [quantities, setQuantities] = useState<Record<string, number>>({});
  return (
    <Modal title={`Receive goods · ${purchase.number}`} onClose={onClose}>
      <SimpleForm
        submit="Post goods receipt"
        onSubmit={async (f) => {
          const lines = purchase.lines
            .filter((l) => (quantities[l.id] || 0) > 0)
            .map((l) => ({
              purchaseLineId: l.id,
              qty: quantities[l.id],
              lot: f.get(`lot-${l.id}`),
              expiresOn: f.get(`expiry-${l.id}`)
                ? new Date(
                    `${f.get(`expiry-${l.id}`)}T23:59:59+06:00`,
                  ).toISOString()
                : null,
            }));
          if (!lines.length)
            throw new Error("Enter at least one received quantity");
          await act(`purchases/${purchase.id}/receive`, {
            clientId,
            warehouseId: f.get("warehouseId"),
            lines,
          });
          onClose();
        }}
      >
        <Field label="Receiving warehouse">
          <select name="warehouseId" required>
            <option value="">Choose warehouse</option>
            {data.warehouses
              .filter((w) => w.distributorId === purchase.distributorId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="form-full receipt-lines">
          {purchase.lines
            .filter((l) => l.qty > l.receivedQty)
            .map((l) => (
              <div className="receipt-item" key={l.id}>
                <h3>
                  {l.sku.name}
                  <span>{l.qty - l.receivedQty} units remaining</span>
                </h3>
                <div className="form-grid">
                  <Field label="Received units">
                    <input
                      type="number"
                      min="0"
                      max={l.qty - l.receivedQty}
                      defaultValue="0"
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          [l.id]: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Batch / lot number">
                    <input
                      name={`lot-${l.id}`}
                      required={(quantities[l.id] || 0) > 0}
                      maxLength={200}
                    />
                  </Field>
                  <Field label="Expiry date (optional)">
                    <input
                      name={`expiry-${l.id}`}
                      type="date"
                      min={data.today}
                    />
                  </Field>
                </div>
              </div>
            ))}
        </div>
      </SimpleForm>
    </Modal>
  );
}
export function ReturnEditor({ onClose }: { onClose: () => void }) {
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const { data: base } = useApp(),
    { act } = useEnterprise(),
    [orderId, setOrderId] = useState("");
  const order = base.orders.find((o) => o.id === orderId);
  return (
    <Modal title="Request return authorization" onClose={onClose}>
      <SimpleForm
        submit="Submit return request"
        onSubmit={async (f) => {
          const lines =
            order?.lines
              .map((l) => ({
                orderLineId: l.id,
                qty: Number(f.get(`qty-${l.id}`) || 0),
                freeQty: Number(f.get(`free-${l.id}`) || 0),
                disposition: f.get(`disposition-${l.id}`),
              }))
              .filter((l) => l.qty + l.freeQty > 0) || [];
          if (!lines.length)
            throw new Error("Select at least one returned unit");
          await act("returns", {
            clientId,
            orderId,
            reason: f.get("reason"),
            lines,
          });
          onClose();
        }}
      >
        <Field label="Delivered order">
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
          >
            <option value="">Choose delivered order</option>
            {base.orders
              .filter((o) => o.status === "DELIVERED")
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} · {o.outlet.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Return reason (10+ characters)">
          <textarea name="reason" minLength={10} maxLength={1000} required />
        </Field>
        <div className="form-full">
          {order?.lines.map((l) => (
            <div className="receipt-item" key={l.id}>
              <h3>{l.sku.name}</h3>
              <div className="form-grid">
                <Field label={`Paid units (delivered ${l.allocatedQty})`}>
                  <input
                    name={`qty-${l.id}`}
                    type="number"
                    min="0"
                    max={l.allocatedQty}
                    defaultValue="0"
                  />
                </Field>
                <Field label={`Free units (delivered ${l.allocatedFreeQty})`}>
                  <input
                    name={`free-${l.id}`}
                    type="number"
                    min="0"
                    max={l.allocatedFreeQty}
                    defaultValue="0"
                  />
                </Field>
                <Field label="Disposition">
                  <select name={`disposition-${l.id}`}>
                    <option value="RESTOCK">Restock if safe</option>
                    <option value="QUARANTINE">
                      Quarantine for inspection
                    </option>
                    <option value="SCRAP">Scrap / damaged</option>
                  </select>
                </Field>
              </div>
            </div>
          ))}
        </div>
      </SimpleForm>
    </Modal>
  );
}
export function TripEditor({ onClose }: { onClose: () => void }) {
  const { data: base } = useApp(),
    { data, act } = useEnterprise(),
    [warehouseId, setWarehouse] = useState(data.warehouses[0]?.id || "");
  const warehouse = data.warehouses.find((w) => w.id === warehouseId),
    occupied = new Set(
      data.trips
        .filter((t) => ["PLANNED", "IN_PROGRESS"].includes(t.status))
        .flatMap((t) => t.stops.map((s) => s.orderId)),
    );
  const eligible = base.orders.filter(
    (o) =>
      o.distributorId === warehouse?.distributorId &&
      ["ALLOCATED", "DISPATCHED"].includes(o.status) &&
      !occupied.has(o.id),
  );
  return (
    <Modal title="Plan delivery trip" onClose={onClose}>
      <SimpleForm
        submit="Optimize & plan trip"
        onSubmit={async (f) => {
          await act("trips", {
            warehouseId,
            vehicleId: f.get("vehicleId"),
            driverId: f.get("driverId"),
            scheduledOn: iso(f.get("scheduledOn")),
            orderIds: f.getAll("orders"),
          });
          onClose();
        }}
      >
        <Field label="Departure warehouse">
          <select
            value={warehouseId}
            onChange={(e) => setWarehouse(e.target.value)}
            required
          >
            {data.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vehicle">
          <select name="vehicleId" required>
            <option value="">Choose vehicle</option>
            {data.vehicles
              .filter((v) => v.distributorId === warehouse?.distributorId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.capacityKg} kg
                </option>
              ))}
          </select>
        </Field>
        <Field label="Assigned driver / sales rep">
          <select name="driverId" required>
            {base.users
              .filter((u) => ["SR", "DISTRIBUTOR"].includes(u.role))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Delivery date">
          <input
            name="scheduledOn"
            type="date"
            defaultValue={base.today}
            required
          />
        </Field>
        <div className="form-full">
          <h3>Allocated orders</h3>
          <p className="muted">
            Stops use nearest-neighbor geographic ordering and a return-to-depot
            distance estimate.
          </p>
          <div className="order-checkboxes">
            {eligible.length ? (
              eligible.map((o) => (
                <label key={o.id}>
                  <input type="checkbox" name="orders" value={o.id} />
                  <span>
                    <strong>
                      {o.number} · {o.outlet.name}
                    </strong>
                    <small>{o.outlet.address}</small>
                  </span>
                  <b>{money(o.totalMinor)}</b>
                </label>
              ))
            ) : (
              <p className="callout">
                Allocate orders in this distribution partner before planning a
                trip.
              </p>
            )}
          </div>
        </div>
      </SimpleForm>
    </Modal>
  );
}
