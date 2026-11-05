"use client";
import { useState } from "react";
import {
  Printer,
  TrendingUp,
  PackageSearch,
  AlertTriangle,
  ArrowRight,
  Download,
} from "lucide-react";
import { useApp } from "../provider";
import { useEnterprise } from "./provider";
import { Badge, Panel, SearchBox } from "../ui";
import { Metrics, Tabs, DataTable, ExportButton, Actions } from "./common";
import { PurchaseEditor } from "./forms";
import { money, label } from "@/lib/format";
export function Analytics() {
  const { user } = useApp(),
    { data } = useEnterprise(),
    [tab, setTab] = useState("replenishment"),
    [q, setQ] = useState(""),
    [purchaseSku, setPurchaseSku] = useState<string | null>(null);
  const products = data.products.filter((p) =>
      p.skuName.toLowerCase().includes(q.toLowerCase()),
    ),
    need = data.products.filter((p) => p.suggestedQty > 0),
    exposure = data.expiry.reduce((s, b) => s + b.valueMinor, 0),
    operator = ["COMPANY_ADMIN", "AREA_MANAGER", "DISTRIBUTOR"].includes(
      user.role,
    );
  return (
    <>
      <Metrics
        items={[
          {
            label: "Suggested replenishment",
            value: need
              .reduce((s, p) => s + p.suggestedQty, 0)
              .toLocaleString(),
            detail: `Across ${need.length} product/distributor positions`,
          },
          {
            label: "A-class products",
            value: data.products.filter((p) => p.classification === "A").length,
            detail: "Products contributing the first 80% of sales value",
          },
          {
            label: "Expiry cost exposure",
            value: money(exposure),
            tone: "rose",
            detail: "Available lots expiring within 30 days",
          },
          {
            label: "Planning window",
            value: "30 days",
            detail: "7-day lead time + 5-day safety stock",
          },
        ]}
      />
      <div className="enterprise-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "replenishment", label: "Demand & replenishment" },
            { id: "abc", label: "ABC classification" },
            { id: "expiry", label: "Expiry risk" },
          ]}
        />
        <Actions>
          <button className="button" onClick={() => window.print()}>
            <Printer size={16} />
            Print analysis
          </button>
          <ExportButton
            name="replenishment-plan"
            rows={data.products.map((p) => ({
              Product: p.skuName,
              OnHand: p.onHand,
              Sold30Days: p.sold,
              DailyDemand: p.dailyDemand,
              DaysCover: p.daysCover ?? "No demand",
              SuggestedUnits: p.suggestedQty,
              ABC: p.classification,
            }))}
          />
        </Actions>
      </div>
      {tab === "replenishment" && (
        <>
          <div className="analytics-method">
            <span className="enterprise-icon">
              <TrendingUp size={25} />
            </span>
            <div>
              <h2>Demand-informed purchase recommendations</h2>
              <p>
                Suggested units = average delivered daily demand × (7 lead days
                + 5 safety days) − sellable on-hand. This is a transparent
                planning heuristic using the last 30 days, without a
                predictive-model claim.
              </p>
            </div>
          </div>
          <Panel>
            <div className="table-toolbar">
              <SearchBox
                value={q}
                onChange={setQ}
                placeholder="Search product performance…"
              />
            </div>
            <DataTable
              rows={products}
              columns={[
                {
                  label: "Product",
                  render: (p) => (
                    <>
                      <strong>{p.skuName}</strong>
                      <span className="cell-sub">Class {p.classification}</span>
                    </>
                  ),
                },
                { label: "Sold / 30 days", render: (p) => p.sold },
                { label: "Daily demand", render: (p) => p.dailyDemand },
                { label: "Sellable stock", render: (p) => p.onHand },
                {
                  label: "Days of cover",
                  render: (p) =>
                    p.daysCover === null ? (
                      "No demand"
                    ) : (
                      <span className={p.daysCover < 7 ? "warning" : ""}>
                        {p.daysCover} days
                      </span>
                    ),
                },
                {
                  label: "Suggested units",
                  render: (p) => <strong>{p.suggestedQty}</strong>,
                },
                {
                  label: "Procure",
                  render: (p) =>
                    operator && p.suggestedQty > 0 ? (
                      <button
                        className="button small"
                        onClick={() => setPurchaseSku(p.skuId)}
                      >
                        Draft purchase <ArrowRight size={14} />
                      </button>
                    ) : (
                      <Badge value="COVERED" />
                    ),
                },
              ]}
            />
          </Panel>
        </>
      )}
      {tab === "abc" && (
        <div className="abc-layout">
          {["A", "B", "C"].map((group, i) => {
            const rows = data.products.filter(
                (p) => p.classification === group,
              ),
              value = rows.reduce((s, p) => s + p.valueMinor, 0),
              total = data.products.reduce((s, p) => s + p.valueMinor, 0);
            return (
              <Panel
                key={group}
                className={`abc-card abc-${group.toLowerCase()}`}
              >
                <span className="abc-letter">{group}</span>
                <h2>
                  {
                    [
                      "Protect your core",
                      "Develop the middle",
                      "Review the long tail",
                    ][i]
                  }
                </h2>
                <p>
                  {rows.length} product positions ·{" "}
                  {total ? ((value / total) * 100).toFixed(1) : 0}% of delivered
                  goods value
                </p>
                <strong>{money(value)}</strong>
                <div className="abc-products">
                  {rows.map((p) => (
                    <div key={`${p.distributorId}-${p.skuId}`}>
                      <span>{p.skuName}</span>
                      <b>{money(p.valueMinor, true)}</b>
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      {tab === "expiry" && (
        <Panel
          title="Expiry watchlist"
          subtitle="Prioritize stock rotation, safe disposition and purchasing decisions"
        >
          <DataTable
            rows={data.expiry}
            empty="No available stock is approaching expiry"
            columns={[
              {
                label: "Product / lot",
                render: (b) => (
                  <>
                    <strong>{b.skuName}</strong>
                    <span className="cell-sub">{b.lot}</span>
                  </>
                ),
              },
              { label: "Warehouse", render: (b) => b.warehouseName },
              { label: "Units exposed", render: (b) => b.qty },
              {
                label: "Days remaining",
                render: (b) => (
                  <span className="warning">
                    {b.daysLeft <= 0 ? "Expired" : `${b.daysLeft} days`}
                  </span>
                ),
              },
              { label: "Cost exposure", render: (b) => money(b.valueMinor) },
            ]}
          />
        </Panel>
      )}
      {purchaseSku && (
        <PurchaseEditor
          skuId={purchaseSku}
          onClose={() => setPurchaseSku(null)}
        />
      )}
    </>
  );
}
