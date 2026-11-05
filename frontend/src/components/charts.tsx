"use client";
import { useState } from "react";
import type { Order } from "@/lib/types";
import { money } from "@/lib/format";
export function SalesChart({
  orders,
  days = 7,
}: {
  orders: Order[];
  days?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const points = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(d);
    return {
      label: d.toLocaleDateString("en-GB", {
        timeZone: "Asia/Dhaka",
        day: "2-digit",
        month: "short",
      }),
      sales: orders
        .filter(
          (o) =>
            o.status === "DELIVERED" &&
            o.delivery?.deliveredAt &&
            new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(
              new Date(o.delivery.deliveredAt),
            ) === key,
        )
        .reduce((s, o) => s + (o.delivery?.invoice?.totalMinor || 0), 0),
    };
  });
  const max = Math.max(...points.map((p) => p.sales), 10000) * 1.15;
  const coords = points.map((p, i) => [
    60 + (i * 680) / (days - 1),
    205 - (p.sales / max) * 170,
  ]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <div className="sales-chart">
      <svg
        viewBox="0 0 780 255"
        role="img"
        aria-label={`Delivered sales over the last ${days} days`}
      >
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c5d9a4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#e9f0dc" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="60"
              x2="740"
              y1={35 + i * 42.5}
              y2={35 + i * 42.5}
              stroke="#edf0ee"
              strokeDasharray="4 5"
            />
            <text x="0" y={40 + i * 42.5}>
              {money(max * (1 - i / 4), true)}
            </text>
          </g>
        ))}
        <path d={`${line} L740,205 L60,205 Z`} fill="url(#sales-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#39765a"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={coords[i][0] - 340 / (days - 1)}
              y="20"
              width={680 / (days - 1)}
              height="190"
              fill="transparent"
            />
            <circle
              cx={coords[i][0]}
              cy={coords[i][1]}
              r={hover === i ? 6 : 3.5}
              fill="#39765a"
              stroke="white"
              strokeWidth="2"
            />
            {(days === 7 || i % 5 === 0 || i === days - 1) && (
              <text x={coords[i][0]} y="238" textAnchor="middle">
                {p.label}
              </text>
            )}
            {hover === i && (
              <title>
                {p.label}: {money(p.sales)}
              </title>
            )}
          </g>
        ))}
      </svg>
      <div className="chart-caption">
        <span>
          <i /> Delivered sales
        </span>
        <span>
          {hover !== null
            ? `${points[hover].label} · ${money(points[hover].sales)}`
            : "Hover over the chart to explore sales"}
        </span>
      </div>
    </div>
  );
}
export function Donut({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="donut">
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-label={`${Math.round(pct)} percent of target achieved`}
      >
        <circle
          cx="90"
          cy="90"
          r="72"
          fill="none"
          stroke="#edf0e8"
          strokeWidth="16"
        />
        <circle
          cx="90"
          cy="90"
          r="72"
          fill="none"
          stroke="#b7ce80"
          strokeWidth="16"
          strokeDasharray={`${pct * 4.524} 452.4`}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div>
        <strong>
          {pct.toFixed(1)}
          <small>%</small>
        </strong>
        <span>of monthly target</span>
      </div>
    </div>
  );
}
