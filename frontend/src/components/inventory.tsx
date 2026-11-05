"use client";
import { useState } from "react";
import { Package, ArrowDownLeft } from "lucide-react";
import { useApp } from "./provider";
import { Badge, Empty, Field, Modal, Panel, SearchBox, SimpleForm } from "./ui";
import { money, number, date } from "@/lib/format";
import { AdminTools } from "./admin-tools";
export function Inventory({
  catalog = false,
  create,
  onCreated,
}: {
  catalog?: boolean;
  create: boolean;
  onCreated: () => void;
}) {
  const { data, mutate } = useApp(),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [ledger, setLedger] = useState(false);
  const skus = data.skus.filter(
    (s) =>
      `${s.name} ${s.code} ${s.category}`
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (filter === "ALL" ||
        (filter === "LOW"
          ? data.stock.some((t) => t.skuId === s.id && t.qty < s.reorderLevel)
          : s.category === filter)),
  );
  return (
    <>
      {catalog && <AdminTools pricing />}
      <div className="mini-stats">
        <div>
          <span>Products in catalog</span>
          <strong>{data.skus.length}</strong>
        </div>
        <div>
          <span>Units on hand</span>
          <strong>{number(data.stock.reduce((s, t) => s + t.qty, 0))}</strong>
        </div>
        <div>
          <span>Below reorder level</span>
          <strong className="warning">
            {data.stock.filter((t) => t.qty < t.sku.reorderLevel).length}
          </strong>
        </div>
      </div>
      <Panel>
        <div className="table-toolbar">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search product or SKU…"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter inventory"
          >
            <option value="ALL">All products</option>
            <option value="LOW">Low stock</option>
            {[...new Set(data.skus.map((s) => s.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="button small" onClick={() => setLedger(true)}>
            Movement ledger
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Trade price</th>
                <th>Pack size</th>
                <th>On hand</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => {
                const qty = data.stock
                  .filter((t) => t.skuId === s.id)
                  .reduce((sum, t) => sum + t.qty, 0);
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="product-name">
                        <span
                          className={`product-icon category-${s.category.split(" ")[0].toLowerCase()}`}
                        >
                          <Package size={21} />
                        </span>
                        <div>
                          <strong>{s.name}</strong>
                          <span className="cell-sub">{s.code}</span>
                        </div>
                      </div>
                    </td>
                    <td>{s.category}</td>
                    <td className="numeric">
                      {money(
                        data.prices?.items.find((i) => i.skuId === s.id)
                          ?.priceMinor || 0,
                      )}
                    </td>
                    <td>
                      {s.packSize} {s.unit}
                    </td>
                    <td className="numeric">
                      {number(qty)} <span className="muted">{s.unit}</span>
                    </td>
                    <td>
                      <Badge
                        value={
                          qty === 0
                            ? "OUT_OF_STOCK"
                            : qty < s.reorderLevel
                              ? "LOW_STOCK"
                              : "IN_STOCK"
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!skus.length && <Empty title="No matching products" />}
      </Panel>
      {ledger && (
        <Modal title="Stock movement ledger" onClose={() => setLedger(false)}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Product</th>
                  <th>Movement</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.reference}
                      <span className="cell-sub">
                        {date(m.createdAt, true)}
                      </span>
                    </td>
                    <td>{data.skus.find((s) => s.id === m.skuId)?.name}</td>
                    <td>
                      <Badge value={m.kind} />
                    </td>
                    <td className="numeric">
                      {m.qty > 0 ? "+" : ""}
                      {m.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {create && (
        <Modal
          title={catalog ? "Add product" : "Receive primary stock"}
          onClose={onCreated}
        >
          <SimpleForm
            onSubmit={async (f) => {
              if (catalog)
                await mutate("masters/skus", {
                  name: f.get("name"),
                  code: f.get("code"),
                  category: f.get("category"),
                  unit: "pcs",
                  packSize: Number(f.get("packSize")),
                  reorderLevel: Number(f.get("reorderLevel")),
                  priceMinor: Math.round(Number(f.get("price")) * 100),
                });
              else
                await mutate("stock/receive", {
                  distributorId: f.get("distributorId"),
                  skuId: f.get("skuId"),
                  qty: Number(f.get("qty")),
                  reference: f.get("reference"),
                });
              onCreated();
            }}
          >
            {catalog ? (
              <>
                <Field label="Product name">
                  <input name="name" required maxLength={200} />
                </Field>
                <Field label="SKU code">
                  <input name="code" required maxLength={200} />
                </Field>
                <Field label="Category">
                  <input name="category" list="categories" required />
                  <datalist id="categories">
                    {[...new Set(data.skus.map((s) => s.category))].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </datalist>
                </Field>
                <Field label="Trade price (BDT)">
                  <input
                    name="price"
                    type="number"
                    min="0"
                    max="20000000"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="Pack size">
                  <input
                    name="packSize"
                    type="number"
                    min="1"
                    defaultValue="12"
                    required
                  />
                </Field>
                <Field label="Reorder level">
                  <input
                    name="reorderLevel"
                    type="number"
                    min="0"
                    defaultValue="50"
                    required
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Distributor">
                  <select name="distributorId" required>
                    {data.distributors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Product">
                  <select name="skuId" required>
                    {data.skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity received">
                  <input
                    name="qty"
                    type="number"
                    min="1"
                    max="100000"
                    required
                  />
                </Field>
                <Field label="Primary invoice reference">
                  <input name="reference" required maxLength={200} />
                </Field>
              </>
            )}
          </SimpleForm>
        </Modal>
      )}
    </>
  );
}
