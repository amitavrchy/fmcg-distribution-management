"use client";
import { useState } from "react";
import { useApp } from "./provider";
import { Badge, Empty, Field, Modal, Panel, SearchBox, SimpleForm } from "./ui";
import { date, money } from "@/lib/format";
export function Claims({
  create,
  onCreated,
}: {
  create: boolean;
  onCreated: () => void;
}) {
  const { data, user, mutate, notify } = useApp(),
    [q, setQ] = useState("");
  const claims = data.claims.filter((c) =>
    `${c.order.number} ${c.order.outlet.name} ${c.reason}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="callout">
        Claims record a financial review request. An approved claim requires an
        accounts settlement; approval does not automatically change inventory or
        invoice balances.
      </div>
      <Panel>
        <div className="table-toolbar">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search order or claim reason…"
          />
          <span className="muted">{claims.length} claims</span>
        </div>
        {claims.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order / outlet</th>
                  <th>Reason</th>
                  <th>Claim amount</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.order.number}</strong>
                      <span className="cell-sub">
                        {c.order.outlet.name} · {date(c.createdAt)}
                      </span>
                    </td>
                    <td className="wrap-cell">{c.reason}</td>
                    <td className="numeric">{money(c.amountMinor)}</td>
                    <td>
                      <Badge value={c.status} />
                    </td>
                    <td>
                      {["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role) &&
                        c.status === "SUBMITTED" && (
                          <div className="row-actions">
                            {["APPROVED", "REJECTED"].map((status) => (
                              <button
                                className="button small"
                                key={status}
                                onClick={async () => {
                                  try {
                                    await mutate(
                                      `claims/${c.id}`,
                                      { status },
                                      "PATCH",
                                    );
                                  } catch (e) {
                                    notify(
                                      e instanceof Error
                                        ? e.message
                                        : "Unable to review claim",
                                    );
                                  }
                                }}
                              >
                                {status === "APPROVED" ? "Approve" : "Reject"}
                              </button>
                            ))}
                          </div>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No claims to review"
            detail="Delivery claims and return requests will appear here."
          />
        )}
      </Panel>
      {create && (
        <Modal title="Submit delivery claim" onClose={onCreated}>
          <SimpleForm
            submit="Submit claim"
            onSubmit={async (f) => {
              await mutate("claims", {
                orderId: f.get("orderId"),
                reason: f.get("reason"),
                amountMinor: Math.round(Number(f.get("amount")) * 100),
              });
              onCreated();
            }}
          >
            <Field label="Delivered order">
              <select name="orderId" required>
                <option value="">Choose delivered order</option>
                {data.orders
                  .filter((o) => o.status === "DELIVERED")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.number} · {o.outlet.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Claim amount (BDT)">
              <input
                type="number"
                name="amount"
                min="0.01"
                max="20000000"
                step="0.01"
                required
              />
            </Field>
            <Field label="Reason / affected products">
              <textarea
                name="reason"
                minLength={10}
                maxLength={1000}
                required
                placeholder="Describe the damage, shortage or return request…"
              />
            </Field>
          </SimpleForm>
        </Modal>
      )}
    </>
  );
}
