"use client";
import { useState, useRef, useEffect } from "react";
import type { Order } from "@/lib/types";
import { money } from "@/lib/format";
export function SalesChart({
  orders,
  days = 7,
  series,
}: {
  orders: Order[];
  days?: number;
  series?: { day: string; totalMinor: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(780);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (chartRef.current) observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);
  const textSize = Math.max(14, (14 * 780) / Math.max(width, 1));
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
      sales: series
        ? series.find((p) => p.day === key)?.totalMinor || 0
        : orders
            .filter(
              (o) =>
                o.status === "DELIVERED" &&
                o.delivery?.deliveredAt &&
                new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Dhaka",
                }).format(new Date(o.delivery.deliveredAt)) === key,
            )
            .reduce((s, o) => s + (o.delivery?.invoice?.totalMinor || 0), 0),
    };
  });
  const max = Math.max(...points.map((p) => p.sales), 10000) * 1.15;
  const min = Math.min(0, ...points.map((p) => p.sales)) * 1.15;
  const chartLeft = width < 500 ? 180 : 100;
  const baseline = 205 - ((0 - min) / (max - min)) * 170;
  const coords = points.map((p, i) => [
    chartLeft + (i * (740 - chartLeft)) / (days - 1),
    205 - ((p.sales - min) / (max - min)) * 170,
  ]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <div className="sales-chart" ref={chartRef}>
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
              x1={chartLeft}
              x2="740"
              y1={35 + i * 42.5}
              y2={35 + i * 42.5}
              stroke="#edf0ee"
              strokeDasharray="4 5"
            />
            <text x="0" y={40 + i * 42.5} style={{ fontSize: textSize }}>
              {money(max - ((max - min) * i) / 4, true)}
            </text>
          </g>
        ))}
        <path
          d={`${line} L740,${baseline} L${chartLeft},${baseline} Z`}
          fill="url(#sales-fill)"
        />
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
            {((days === 7 && (width >= 500 || i % 3 === 0)) ||
              (days !== 7 &&
                i % Math.ceil(days / (width < 500 ? 3 : 6)) === 0) ||
              i === days - 1) && (
              <text
                x={coords[i][0]}
                y="238"
                textAnchor="middle"
                style={{ fontSize: textSize }}
              >
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
