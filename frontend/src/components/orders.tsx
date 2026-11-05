"use client";
import { useState, useEffect } from "react";
import { ArrowRight, Eye, Truck } from "lucide-react";
import { useApp } from "./provider";
import { Badge, Empty, Modal, Panel, SearchBox } from "./ui";
import { money, date, label } from "@/lib/format";
import type { Order } from "@/lib/types";
import { api } from "@/lib/api";
const steps: Record<string, string[]> = {
  SUBMITTED: ["CONFIRMED", "CANCELLED"],
  PENDING_APPROVAL: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ALLOCATED", "CANCELLED"],
  ALLOCATED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED"],
};
export function Orders({ delivery = false }: { delivery?: boolean }) {
  const { data, user, mutate, notify, online } = useApp(),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("ALL"),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [history, setHistory] = useState<{ rows: Order[]; total: number } | null>(
      null,
    ),
    [historyError, setHistoryError] = useState("");
  useEffect(() => {
    setPage(1);
  }, [q, status, delivery]);
  useEffect(() => {
    if (!online) return;
    let live = true;
    const timer = setTimeout(() => {
      void api<{ rows: Order[]; total: number }>(
        `orders?${new URLSearchParams({ page: String(page), q, status, delivery: String(delivery) })}`,
      )
        .then((result) => {
          if (live) {
            setHistory(result);
            setHistoryError("");
          }
        })
        .catch((e) => {
          if (live)
            setHistoryError(
              e instanceof Error ? e.message : "Unable to load order history",
            );
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [online, page, q, status, delivery, data.serverTime]);
  const filtered = data.orders.filter(
    (o) =>
      (!delivery || !!o.delivery) &&
      (status === "ALL" || status === o.status) &&
      `${o.number} ${o.outlet.name} ${o.sr.fullName}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const orders = online && history ? history.rows : filtered;
  const current =
    orders.find((o) => o.id === selected) ||
    data.orders.find((o) => o.id === selected);
  const operate = ["COMPANY_ADMIN", "AREA_MANAGER", "DISTRIBUTOR"].includes(
    user.role,
  );
  const transition = async (o: Order, to: string) => {
    if (
      to === "CANCELLED" &&
      !confirm(`Cancel ${o.number}? Allocated stock will be restored.`)
    )
      return;
    setBusy(true);
    try {
      await mutate(`orders/${o.id}/status`, { status: to }, "PATCH");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Unable to update order");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {!online && data.historyLimited && (
        <p className="callout">
          Showing your latest 500 orders. Overview totals and sales charts
          include your complete sales history.
        </p>
      )}
      {historyError && (
        <p role="alert" className="form-error">
          {historyError}
        </p>
      )}
      <div className="mini-stats">
        <div>
          <span>
            {delivery ? "Planned deliveries" : "Orders awaiting action"}
          </span>
          <strong>
            {
              data.orders.filter((o) =>
                delivery
                  ? o.delivery?.status === "PLANNED"
                  : ["SUBMITTED", "PENDING_APPROVAL"].includes(o.status),
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Delivered</span>
          <strong>
            {data.orders.filter((o) => o.status === "DELIVERED").length}
          </strong>
        </div>
        <div>
          <span>Order book value</span>
          <strong>
            {money(
              data.orders
                .filter((o) => o.status !== "CANCELLED")
                .reduce((s, o) => s + o.totalMinor, 0),
            )}
          </strong>
        </div>
      </div>
      <Panel>
        <div className="table-toolbar">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search order, outlet or sales rep…"
          />
          <select
            aria-label="Filter order status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            {[
              "SUBMITTED",
              "PENDING_APPROVAL",
              "CONFIRMED",
              "ALLOCATED",
              "DISPATCHED",
              "DELIVERED",
              "CANCELLED",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="muted">{orders.length} records</span>
        </div>
        {orders.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Outlet</th>
                  <th>Sales representative</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => setSelected(o.id)}
                      >
                        {o.number}
                      </button>
                      <span className="cell-sub">
                        {date(o.orderedAt, true)}
                      </span>
                    </td>
                    <td>
                      <strong>{o.outlet.name}</strong>
                      <span className="cell-sub">{o.outlet.code}</span>
                    </td>
                    <td>{o.sr.fullName}</td>
                    <td className="numeric">
                      {money(o.totalMinor)}
                      {o.backorder && (
                        <span className="cell-sub warning">
                          Partial · backorder
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge value={o.status} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View ${o.number}`}
                        onClick={() => setSelected(o.id)}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching orders"
            detail="Try another search or create your first order."
          />
        )}
      </Panel>
      {online && history && (
        <div className="pagination">
          <span>
            {history.total} records · Page {page} of{" "}
            {Math.max(1, Math.ceil(history.total / 25))}
          </span>
          <div>
            <button
              className="button small"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="button small"
              disabled={page * 25 >= history.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {current && (
        <Modal title={current.number} onClose={() => setSelected(null)}>
          <div className="detail-overview">
            <div>
              <h3>{current.outlet.name}</h3>
              <p>{current.outlet.address}</p>
              <p>
                {current.sr.fullName} · {date(current.orderedAt, true)}
              </p>
            </div>
            <Badge value={current.status} />
          </div>
          <div className="order-timeline">
            {[
              "SUBMITTED",
              "CONFIRMED",
              "ALLOCATED",
              "DISPATCHED",
              "DELIVERED",
            ].map((s, i) => (
              <span
                key={s}
                className={
                  [
                    "SUBMITTED",
                    "CONFIRMED",
                    "ALLOCATED",
                    "DISPATCHED",
                    "DELIVERED",
                  ].indexOf(current.status) >= i
                    ? "done"
                    : ""
                }
              >
                {i + 1}
                <small>{label(s)}</small>
              </span>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Ordered</th>
                  <th>Free</th>
                  <th>Allocated</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {current.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.sku.name}</td>
                    <td>{l.qty}</td>
                    <td>{l.freeQty}</td>
                    <td>
                      {l.allocatedQty} + {l.allocatedFreeQty} free
                    </td>
                    <td>{money(l.qty * l.unitPriceMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="order-summary">
            <div>
              <span>Goods value</span>
              <strong>{money(current.goodsMinor)}</strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>−{money(current.discountMinor)}</strong>
            </div>
            <div className="total">
              <span>Order total</span>
              <strong>{money(current.totalMinor)}</strong>
            </div>
            {current.delivery?.invoice && (
              <>
                <div>
                  <span>Delivered invoice</span>
                  <strong>{money(current.delivery.invoice.totalMinor)}</strong>
                </div>
                <div>
                  <span>Paid</span>
                  <strong>{money(current.delivery.invoice.paidMinor)}</strong>
                </div>
              </>
            )}
          </div>
          {current.notes && <p className="callout">{current.notes}</p>}
          {current.backorder && (
            <p className="callout warning">
              <Truck size={18} />
              Unallocated quantities remain a backorder. Create a new order to
              fulfill the remainder.
            </p>
          )}
          {operate && (
            <div className="form-footer">
              {steps[current.status]?.map((to) => (
                <button
                  disabled={busy}
                  key={to}
                  className={`button ${to === "CANCELLED" ? "danger" : "primary"}`}
                  onClick={() => void transition(current, to)}
                >
                  {to === "CONFIRMED" && current.status === "PENDING_APPROVAL"
                    ? "Approve credit & confirm"
                    : label(to)}
                  {to !== "CANCELLED" && <ArrowRight size={16} />}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
