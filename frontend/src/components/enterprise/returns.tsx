"use client";
import { useState } from "react";
import { Plus, RotateCcw, PackageCheck, Wallet } from "lucide-react";
import { useApp } from "../provider";
import { useEnterprise } from "./provider";
import { Badge, Field, Modal, Panel, SimpleForm } from "../ui";
import { Metrics, DataTable, StateSteps, Actions } from "./common";
import { BusinessForm, ReturnEditor } from "./forms";
import { money, date } from "@/lib/format";
export function Returns() {
  const { user } = useApp(),
    { data, act, run, working } = useEnterprise(),
    [form, setForm] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const manager = ["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role),
    operator = manager || user.role === "DISTRIBUTOR",
    account = manager || user.role === "ACCOUNTS",
    item = data.returns.find((r) => r.id === selected);
  return (
    <>
      <Metrics
        items={[
          {
            label: "Return requests",
            value: data.returns.length,
            detail: "Line-level return authorizations",
          },
          {
            label: "Awaiting approval",
            value: data.returns.filter((r) => r.status === "REQUESTED").length,
            tone: "amber",
          },
          {
            label: "Credits issued",
            value: money(
              data.returns.reduce(
                (s, r) => s + (r.credit?.amountMinor || 0),
                0,
              ),
            ),
            detail: "Posted after physical receipt",
          },
          {
            label: "Refunds outstanding",
            value: money(data.summary.pendingRefundMinor),
            tone: "rose",
            detail: "Customer money awaiting settlement",
          },
        ]}
      />
      <div className="return-explainer">
        <span className="enterprise-icon">
          <RotateCcw size={25} />
        </span>
        <div>
          <h2>A complete return-to-settlement loop</h2>
          <p>
            Authorize → inspect & receive → recover stock → issue credit →
            settle refunds. Free units never generate monetary credits.
          </p>
        </div>
        {["COMPANY_ADMIN", "AREA_MANAGER", "SR", "DISTRIBUTOR"].includes(
          user.role,
        ) && (
          <button className="button primary" onClick={() => setForm("return")}>
            <Plus size={17} />
            Request return
          </button>
        )}
      </div>
      <Panel title="Return authorizations">
        <DataTable
          rows={data.returns}
          columns={[
            {
              label: "Authorization",
              render: (r) => (
                <>
                  <button
                    className="link-button"
                    onClick={() => setSelected(r.id)}
                  >
                    {r.number}
                  </button>
                  <span className="cell-sub">{date(r.createdAt)}</span>
                </>
              ),
            },
            {
              label: "Order / outlet",
              render: (r) => (
                <>
                  {r.order.number}
                  <span className="cell-sub">{r.order.outlet.name}</span>
                </>
              ),
            },
            {
              label: "Units",
              render: (r) => r.lines.reduce((s, l) => s + l.qty + l.freeQty, 0),
            },
            { label: "Status", render: (r) => <Badge value={r.status} /> },
            {
              label: "Credit",
              render: (r) =>
                r.credit ? (
                  <>
                    <strong>{money(r.credit.amountMinor)}</strong>
                    <span className="cell-sub">{r.credit.number}</span>
                  </>
                ) : (
                  "After receipt"
                ),
            },
            {
              label: "Action",
              render: (r) => (
                <button
                  className="button small"
                  onClick={() => setSelected(r.id)}
                >
                  Review details
                </button>
              ),
            },
          ]}
        />
      </Panel>
      {item && (
        <Modal title={item.number} onClose={() => setSelected(null)}>
          <StateSteps
            states={["REQUESTED", "APPROVED", "RECEIVED", "SETTLED"]}
            current={item.status}
          />
          <p className="callout">{item.reason}</p>
          <DataTable
            rows={item.lines}
            columns={[
              { label: "Product", render: (l) => l.orderLine.sku.name },
              { label: "Paid units", render: (l) => l.qty },
              { label: "Free units", render: (l) => l.freeQty },
              {
                label: "Disposition",
                render: (l) => <Badge value={l.disposition} />,
              },
            ]}
          />
          {item.credit && (
            <div className="order-summary">
              <div>
                <span>Credit note</span>
                <strong>{item.credit.number}</strong>
              </div>
              <div>
                <span>Total returned sale value</span>
                <strong>{money(item.credit.amountMinor)}</strong>
              </div>
              <div>
                <span>Applied to invoice</span>
                <strong>{money(item.credit.appliedMinor)}</strong>
              </div>
              <div>
                <span>Refund liability</span>
                <strong>
                  {money(item.credit.refundMinor)} ·{" "}
                  {item.credit.refundPaid ? "Paid" : "Pending"}
                </strong>
              </div>
            </div>
          )}
          <div className="form-footer">
            {item.status === "REQUESTED" && manager && (
              <>
                <button
                  className="button primary"
                  disabled={working}
                  onClick={() =>
                    void run(
                      `returns/${item.id}`,
                      { status: "APPROVED" },
                      "PATCH",
                    )
                  }
                >
                  Authorize return
                </button>
                <button
                  className="button danger"
                  disabled={working}
                  onClick={() =>
                    void run(
                      `returns/${item.id}`,
                      { status: "REJECTED" },
                      "PATCH",
                    )
                  }
                >
                  Reject
                </button>
              </>
            )}
            {item.status === "APPROVED" && operator && (
              <button
                className="button primary"
                onClick={() => {
                  setSelected(null);
                  setForm(`receive:${item.id}`);
                }}
              >
                <PackageCheck size={17} />
                Receive returned goods
              </button>
            )}
            {item.credit && !item.credit.refundPaid && account && (
              <button
                className="button primary"
                onClick={() => {
                  setSelected(null);
                  setForm(`refund:${item.credit!.id}`);
                }}
              >
                <Wallet size={17} />
                Pay refund
              </button>
            )}
          </div>
        </Modal>
      )}
      {form === "return" && <ReturnEditor onClose={() => setForm("")} />}{" "}
      {form.startsWith("receive:") && (
        <Modal title="Inspect & receive return" onClose={() => setForm("")}>
          <p className="modal-description">
            Confirm the returned quantities physically match the authorization.
            Expired or recalled stock is quarantined automatically.
          </p>
          <SimpleForm
            submit="Receive stock & issue credit"
            onSubmit={async (f) => {
              await act(`returns/${form.split(":")[1]}/receive`, {
                warehouseId: f.get("warehouseId"),
              });
              setForm("");
            }}
          >
            <Field label="Inspection warehouse">
              <select name="warehouseId" required>
                <option value="">Choose warehouse</option>
                {data.warehouses
                  .filter(
                    (w) =>
                      w.distributorId ===
                      data.returns.find((r) => r.id === form.split(":")[1])
                        ?.order.distributorId,
                  )
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </Field>
          </SimpleForm>
        </Modal>
      )}
      {form.startsWith("refund:") && (
        <BusinessForm
          mode="refund"
          targetId={form.split(":")[1]}
          onClose={() => setForm("")}
        />
      )}
    </>
  );
}
