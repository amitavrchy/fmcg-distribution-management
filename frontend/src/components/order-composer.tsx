"use client";
import { useState, useMemo } from "react";
import { Plus, Trash2, WifiOff } from "lucide-react";
import { useApp } from "./provider";
import { api } from "@/lib/api";
import { enqueue } from "@/lib/offline";
import { money } from "@/lib/format";
import { Field, Modal, Submit } from "./ui";
export function OrderComposer({ onClose }: { onClose: () => void }) {
  const { data, user, refresh, notify, online } = useApp();
  const [outletId, setOutlet] = useState(""),
    [distributorId, setDistributor] = useState(data.distributors[0]?.id || ""),
    [lines, setLines] = useState([{ skuId: data.skus[0]?.id || "", qty: 1 }]),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{
      totalMinor: number;
      discountMinor: number;
      applied: string[];
      free: Record<string, number>;
    } | null>(null);
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const subtotal = lines.reduce(
    (s, l) =>
      s +
      l.qty *
        (data.prices?.items.find((i) => i.skuId === l.skuId)?.priceMinor || 0),
    0,
  );
  const payload = () => ({
    clientOrderId: clientId,
    outletId,
    distributorId,
    priceListVersion: data.prices?.version || 1,
    orderedAt: new Date().toISOString(),
    notes,
    lines,
  });
  const change = (i: number, key: "skuId" | "qty", value: string | number) => {
    setLines((prev) =>
      prev.map((l, j) => (j === i ? { ...l, [key]: value } : l)),
    );
    setPreview(null);
  };
  const allowed = ["COMPANY_ADMIN", "AREA_MANAGER", "SR"].includes(user.role);
  return (
    <Modal title="Create secondary order" onClose={onClose}>
      {!allowed ? (
        <p className="form-error">
          Your role can process orders. A sales representative or manager can
          create them.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const p = payload();
              if (new Set(lines.map((l) => l.skuId)).size !== lines.length)
                throw new Error("Choose each product once.");
              if (!online) {
                await enqueue({
                  id: clientId,
                  ownerId: user.id,
                  type: "ORDER",
                  payload: p,
                  createdAt: new Date().toISOString(),
                });
                notify("Order saved offline. It will sync when you reconnect.");
              } else {
                await api("orders", p);
                notify("Order submitted successfully");
              }
              await refresh();
              onClose();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Unable to create order",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {!online && (
            <p className="offline-banner">
              <WifiOff size={17} />
              Saved on this device until your connection returns.
            </p>
          )}
          <div className="form-grid">
            <Field label="Retail outlet">
              <select
                value={outletId}
                onChange={(e) => {
                  setOutlet(e.target.value);
                  setPreview(null);
                }}
                required
              >
                <option value="">Choose an outlet</option>
                {data.outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {o.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fulfilled by">
              <select
                value={distributorId}
                onChange={(e) => setDistributor(e.target.value)}
                required
              >
                {data.distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="order-lines">
            <div className="line-heading">
              <h3>Order items</h3>
              <span className="muted">Price list v{data.prices?.version}</span>
            </div>
            {lines.map((l, i) => (
              <div className="order-line" key={i}>
                <Field label="Product">
                  <select
                    value={l.skuId}
                    onChange={(e) => change(i, "skuId", e.target.value)}
                    required
                  >
                    {data.skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    required
                    value={l.qty}
                    onChange={(e) => change(i, "qty", Number(e.target.value))}
                  />
                </Field>
                <strong>
                  {money(
                    l.qty *
                      (data.prices?.items.find((p) => p.skuId === l.skuId)
                        ?.priceMinor || 0),
                  )}
                </strong>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove product"
                  disabled={lines.length === 1}
                  onClick={() => {
                    setLines(lines.filter((_, j) => j !== i));
                    setPreview(null);
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button small"
              onClick={() => {
                setLines([
                  ...lines,
                  {
                    skuId:
                      data.skus.find(
                        (s) => !lines.some((l) => l.skuId === s.id),
                      )?.id || "",
                    qty: 1,
                  },
                ]);
                setPreview(null);
              }}
              disabled={lines.length >= data.skus.length}
            >
              <Plus size={16} />
              Add product
            </button>
          </div>
          <Field label="Delivery notes (optional)">
            <textarea
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any instructions for the delivery team?"
            />
          </Field>
          <div className="order-summary">
            <div>
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            {preview && (
              <>
                <div>
                  <span>Scheme savings</span>
                  <strong>−{money(preview.discountMinor)}</strong>
                </div>
                <p>{preview.applied.join(" · ") || "No applicable schemes"}</p>
                {Object.entries(preview.free).map(([id, qty]) => (
                  <p key={id}>
                    {qty} free × {data.skus.find((s) => s.id === id)?.name} ·
                    subject to stock
                  </p>
                ))}
              </>
            )}
            <div className="total">
              <span>{preview ? "Order total" : "Total before schemes"}</span>
              <strong>{money(preview?.totalMinor ?? subtotal)}</strong>
            </div>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button
              type="button"
              className="button"
              disabled={!online || !outletId || busy}
              onClick={async () => {
                setError("");
                try {
                  setPreview(await api("orders/preview", payload()));
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Preview unavailable",
                  );
                }
              }}
            >
              Preview schemes
            </button>
            <Submit
              busy={busy}
              label={online ? "Submit order" : "Save offline order"}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
