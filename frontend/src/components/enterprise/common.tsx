"use client";
import { useState, ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Download,
  ArrowRight,
  Plus,
  ChevronRight,
} from "lucide-react";
import { money, label } from "@/lib/format";
import { exportCsv } from "@/lib/export";
export function Metrics({
  items,
}: {
  items: {
    label: string;
    value: string | number;
    detail?: string;
    tone?: string;
  }[];
}) {
  return (
    <div className="enterprise-metrics">
      {items.map((m, i) => (
        <div className={`enterprise-metric ${m.tone || ""}`} key={m.label}>
          <span className="metric-index">0{i + 1}</span>
          <p>{m.label}</p>
          <strong>{m.value}</strong>
          {m.detail && <small>{m.detail}</small>}
        </div>
      ))}
    </div>
  );
}
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="enterprise-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={value === t.id ? "selected" : ""}
        >
          {t.label}
          {t.count !== undefined && <span>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Actions({ children }: { children: ReactNode }) {
  return <div className="enterprise-actions">{children}</div>;
}
export function ExportButton({
  name,
  rows,
}: {
  name: string;
  rows: Record<string, string | number>[];
}) {
  return (
    <button
      className="button small"
      onClick={() => exportCsv(name, rows)}
      disabled={!rows.length}
    >
      <Download size={15} />
      Export CSV
    </button>
  );
}
export function StateSteps({
  states,
  current,
}: {
  states: string[];
  current: string;
}) {
  const active = states.indexOf(current);
  return (
    <div className="state-steps">
      {states.map((s, i) => (
        <div key={s} className={i <= active ? "done" : ""}>
          <span>{i + 1}</span>
          {label(s)}
          {i < states.length - 1 && <ChevronRight size={15} />}
        </div>
      ))}
    </div>
  );
}
export function DataTable<T>({
  rows,
  columns,
  empty = "No matching records yet",
}: {
  rows: T[];
  columns: { label: string; render: (row: T) => ReactNode }[];
  empty?: string;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {columns.map((c, i) => (
                  <td key={i}>{c.render(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <div className="enterprise-empty">{empty}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
