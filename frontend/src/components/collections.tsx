"use client";
import { useState, useMemo } from "react";
import { useApp } from "./provider";
import { Badge, Empty, Field, Modal, Panel, SearchBox, SimpleForm } from "./ui";
import { money, date, due } from "@/lib/format";
import { enqueue } from "@/lib/offline";
import { api } from "@/lib/api";
export function Collections({
  create,
  onCreated,
}: {
  create: boolean;
  onCreated: () => void;
}) {
  const { data, user, mutate, notify, online, refresh } = useApp(),
    [q, setQ] = useState(""),
    [method, setMethod] = useState("ALL");
  const clientId = useMemo(() => crypto.randomUUID(), [create]);
  const collections = data.collections.filter(
    (c) =>
      `${c.outlet.name} ${c.reference}`
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (method === "ALL" || c.method === method),
  );
  const canReconcile = ["COMPANY_ADMIN", "AREA_MANAGER", "ACCOUNTS"].includes(
    user.role,
  );
  return (
    <>
      <div className="mini-stats">
        <div>
          <span>Received & cleared</span>
          <strong>
            {money(
              data.collections
                .filter((c) =>
                  c.method === "CHEQUE"
                    ? c.status === "RECONCILED"
                    : c.status !== "BOUNCED",
                )
                .reduce((s, c) => s + c.amountMinor, 0),
            )}
          </strong>
        </div>
        <div>
          <span>Outstanding invoices</span>
          <strong>
            {money(data.invoices.reduce((s, i) => s + due(i), 0))}
          </strong>
        </div>
        <div>
          <span>Cheques awaiting clearing</span>
          <strong>
            {
              data.collections.filter(
                (c) => c.method === "CHEQUE" && c.status === "POSTED",
              ).length
            }
          </strong>
        </div>
      </div>
      <Panel>
        <div className="table-toolbar">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search outlet or payment reference…"
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            aria-label="Filter payment method"
          >
            <option value="ALL">All payment methods</option>
            {["CASH", "BKASH", "NAGAD", "CHEQUE"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Outlet / collected</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.outlet.name}</strong>
                    <span className="cell-sub">
                      {date(c.collectedAt, true)} · {c.sr.fullName}
                    </span>
                  </td>
                  <td>
                    <Badge value={c.method} />
                  </td>
                  <td>{c.reference || "—"}</td>
                  <td className="numeric">{money(c.amountMinor)}</td>
                  <td>
                    <Badge value={c.status} />
                  </td>
                  <td>
                    {canReconcile && c.status === "POSTED" && (
                      <div className="row-actions">
                        {[
                          "RECONCILED",
                          ...(c.method === "CHEQUE" ? ["BOUNCED"] : []),
                        ].map((status) => (
                          <button
                            key={status}
                            className="button small"
                            onClick={async () => {
                              try {
                                await mutate(
                                  `collections/${c.id}/status`,
                                  { status },
                                  "PATCH",
                                );
                              } catch (e) {
                                notify(
                                  e instanceof Error
                                    ? e.message
                                    : "Unable to reconcile",
                                );
                              }
                            }}
                          >
                            {status === "RECONCILED"
                              ? "Reconcile"
                              : "Mark bounced"}
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
        {!collections.length && <Empty title="No collections found" />}
      </Panel>
      {create && (
        <Modal title="Record collection" onClose={onCreated}>
          <p className="modal-description">
            Payments settle the oldest unpaid invoices first. Cheques settle
            after reconciliation.
          </p>
          <SimpleForm
            submit={online ? "Post collection" : "Save offline collection"}
            onSubmit={async (f) => {
              const payload = {
                clientCollectionId: clientId,
                outletId: f.get("outletId"),
                amountMinor: Math.round(Number(f.get("amount")) * 100),
                method: f.get("method"),
                reference: f.get("reference"),
                collectedAt: new Date().toISOString(),
              };
              if (!online) {
                await enqueue({
                  id: clientId,
                  ownerId: user.id,
                  type: "COLLECTION",
                  payload,
                  createdAt: new Date().toISOString(),
                });
                notify("Collection saved offline");
              } else await api("collections", payload);
              await refresh();
              onCreated();
            }}
          >
            <Field label="Outlet">
              <select name="outletId" required>
                <option value="">Choose an outlet</option>
                {data.outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · due{" "}
                    {money(
                      data.invoices
                        .filter((i) => i.outletId === o.id)
                        .reduce((s, i) => s + due(i), 0),
                    )}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (BDT)">
              <input
                name="amount"
                type="number"
                min="0.01"
                max="20000000"
                step="0.01"
                required
              />
            </Field>
            <Field label="Payment method">
              <select name="method">
                {["CASH", "BKASH", "NAGAD", "CHEQUE"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Transaction / cheque reference">
              <input
                name="reference"
                maxLength={100}
                placeholder="Required for digital payments and cheques"
              />
            </Field>
          </SimpleForm>
        </Modal>
      )}
    </>
  );
}
