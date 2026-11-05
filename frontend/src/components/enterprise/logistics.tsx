"use client";
import { useState } from "react";
import {
  Plus,
  Truck,
  MapPin,
  Navigation,
  CheckCircle2,
  Play,
  Flag,
  Package,
} from "lucide-react";
import { useApp } from "../provider";
import { useEnterprise } from "./provider";
import { Badge, Panel } from "../ui";
import { Metrics, Tabs, DataTable, Actions } from "./common";
import { BusinessForm, TripEditor } from "./forms";
import { date, money } from "@/lib/format";
import type { Trip } from "@/lib/enterprise";
function RouteSketch({ trip }: { trip: Trip }) {
  const points = [
      { lat: trip.warehouse.lat, lng: trip.warehouse.lng },
      ...trip.stops.map((s) => ({
        lat: s.order.outlet.lat || trip.warehouse.lat,
        lng: s.order.outlet.lng || trip.warehouse.lng,
      })),
    ],
    minLat = Math.min(...points.map((p) => p.lat)),
    maxLat = Math.max(...points.map((p) => p.lat)),
    minLng = Math.min(...points.map((p) => p.lng)),
    maxLng = Math.max(...points.map((p) => p.lng));
  const xy = points.map((p) => ({
    x: 65 + ((p.lng - minLng) / Math.max(maxLng - minLng, 0.001)) * 470,
    y: 255 - ((p.lat - minLat) / Math.max(maxLat - minLat, 0.001)) * 190,
  }));
  return (
    <div className="route-sketch">
      <div className="route-sketch-grid" />
      <svg
        viewBox="0 0 600 320"
        role="img"
        aria-label={`Geographic sketch of ${trip.stops.length} stops; not a road map`}
      >
        <path
          d={[...xy, xy[0]]
            .map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`)
            .join(" ")}
          fill="none"
          stroke="#749c75"
          strokeWidth="2.5"
          strokeDasharray="7 5"
        />
        {xy.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={i ? 17 : 22}
              fill={
                i
                  ? trip.stops[i - 1].status === "DELIVERED"
                    ? "#275a42"
                    : "#fff"
                  : "#263e32"
              }
              stroke="#91b179"
              strokeWidth="2"
            />
            <text
              x={p.x}
              y={p.y + 5}
              textAnchor="middle"
              fill={
                i && trip.stops[i - 1].status !== "DELIVERED"
                  ? "#36573c"
                  : "#fff"
              }
              fontSize="16"
              fontWeight="600"
            >
              {i || "H"}
            </text>
          </g>
        ))}
      </svg>
      <div className="route-sketch-key">
        <span>
          <i /> Depot & planned stop sequence
        </span>
        <span>Geographic estimate · no road traffic data</span>
      </div>
    </div>
  );
}
export function Logistics() {
  const { data: base, user } = useApp(),
    { data, run, working } = useEnterprise(),
    [tab, setTab] = useState("trips"),
    [selected, setSelected] = useState<string | null>(
      data.trips[0]?.id || null,
    ),
    [form, setForm] = useState("");
  const trip = data.trips.find((t) => t.id === selected) || data.trips[0],
    operator = ["COMPANY_ADMIN", "AREA_MANAGER", "DISTRIBUTOR"].includes(
      user.role,
    );
  return (
    <>
      <Metrics
        items={[
          {
            label: "Trips in motion",
            value: data.summary.activeTrips,
            detail: "Live delivery execution",
          },
          {
            label: "Planned departures",
            value: data.trips.filter((t) => t.status === "PLANNED").length,
            detail: "Awaiting loading and dispatch",
          },
          {
            label: "Delivered stops",
            value: data.trips
              .flatMap((t) => t.stops)
              .filter((s) => s.status === "DELIVERED").length,
            detail: "Recipient and POD reference captured",
          },
          {
            label: "Fleet capacity",
            value: `${data.vehicles.reduce((s, v) => s + v.capacityKg, 0).toLocaleString()} kg`,
            detail: `${data.vehicles.length} vehicles in your network`,
          },
        ]}
      />
      <div className="enterprise-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            {
              id: "trips",
              label: "Dispatch control",
              count: data.trips.length,
            },
            {
              id: "fleet",
              label: "Fleet & capacity",
              count: data.vehicles.length,
            },
          ]}
        />
        <Actions>
          {operator && (
            <>
              <button className="button" onClick={() => setForm("vehicle")}>
                <Plus size={16} />
                Vehicle
              </button>
              <button
                className="button primary"
                onClick={() => setForm("trip")}
              >
                <Navigation size={17} />
                Plan trip
              </button>
            </>
          )}
        </Actions>
      </div>
      {tab === "fleet" && (
        <div className="vehicle-grid">
          {data.vehicles.map((v) => (
            <Panel key={v.id} className="vehicle-card">
              <span className="enterprise-icon">
                <Truck size={29} />
              </span>
              <div>
                <h2>{v.name}</h2>
                <p>{v.registration}</p>
              </div>
              <strong>
                {v.capacityKg.toLocaleString()} <small>kg capacity</small>
              </strong>
              <Badge
                value={
                  data.trips.some(
                    (t) => t.vehicleId === v.id && t.status === "IN_PROGRESS",
                  )
                    ? "ON_ROUTE"
                    : "AVAILABLE"
                }
              />
            </Panel>
          ))}
          {!data.vehicles.length && (
            <div className="enterprise-empty">
              Add a vehicle to enable capacity-aware delivery trips.
            </div>
          )}
        </div>
      )}
      {tab === "trips" &&
        (trip ? (
          <div className="dispatch-layout">
            <aside className="trip-selector">
              {data.trips.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={trip.id === t.id ? "selected" : ""}
                >
                  <div>
                    <strong>{t.number}</strong>
                    <Badge value={t.status} />
                  </div>
                  <p>
                    {t.vehicle.name} · {date(t.scheduledOn)}
                  </p>
                  <footer>
                    <span>{t.stops.length} stops</span>
                    <span>{t.distanceKm.toFixed(1)} km estimate</span>
                  </footer>
                </button>
              ))}
            </aside>
            <Panel className="trip-detail">
              <div className="trip-heading">
                <div>
                  <span className="eyebrow">DELIVERY EXECUTION</span>
                  <h2>{trip.number}</h2>
                  <p>
                    {trip.vehicle.registration} ·{" "}
                    {base.users.find((u) => u.id === trip.driverId)?.fullName ||
                      "Assigned driver"}{" "}
                    · {date(trip.scheduledOn)}
                  </p>
                </div>
                <Badge value={trip.status} />
              </div>
              <RouteSketch trip={trip} />
              <div className="trip-load">
                <Package size={18} />
                <strong>
                  {trip.loadKg.toFixed(1)} / {trip.vehicle.capacityKg} kg
                </strong>
                <div className="progress">
                  <span
                    style={{
                      width: `${(trip.loadKg / trip.vehicle.capacityKg) * 100}%`,
                    }}
                  />
                </div>
                <span>
                  {trip.stops.filter((s) => s.status === "DELIVERED").length}/
                  {trip.stops.length} delivered
                </span>
              </div>
              <div className="trip-stop-list">
                {trip.stops.map((stop) => (
                  <div className="trip-stop" key={stop.id}>
                    <span
                      className={`stop-marker ${stop.status.toLowerCase()}`}
                    >
                      {stop.status === "DELIVERED" ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        stop.sequence
                      )}
                    </span>
                    <div>
                      <h3>{stop.order.outlet.name}</h3>
                      <p>
                        {stop.order.number} · {stop.order.outlet.address}
                      </p>
                      {stop.recipientName && (
                        <span className="cell-sub">
                          Received by {stop.recipientName} · POD{" "}
                          {stop.proofReference}
                        </span>
                      )}
                      {stop.note && (
                        <span className="cell-sub">{stop.note}</span>
                      )}
                    </div>
                    <Badge value={stop.status} />
                    {trip.status === "IN_PROGRESS" &&
                      stop.status === "PENDING" && (
                        <button
                          className="button small"
                          onClick={() => setForm(`proof:${stop.id}`)}
                        >
                          Record outcome
                        </button>
                      )}
                  </div>
                ))}
              </div>
              {(operator || trip.driverId === user.id) && (
                <div className="trip-footer">
                  {trip.status === "PLANNED" && (
                    <button
                      className="button primary"
                      disabled={working}
                      onClick={() =>
                        void run(
                          `trips/${trip.id}`,
                          { status: "IN_PROGRESS" },
                          "PATCH",
                        )
                      }
                    >
                      <Play size={16} />
                      Dispatch trip
                    </button>
                  )}
                  {trip.status === "IN_PROGRESS" && (
                    <button
                      className="button primary"
                      disabled={
                        working ||
                        trip.stops.some((s) => s.status === "PENDING")
                      }
                      onClick={() =>
                        void run(
                          `trips/${trip.id}`,
                          { status: "CLOSED" },
                          "PATCH",
                        )
                      }
                    >
                      <Flag size={16} />
                      Close completed trip
                    </button>
                  )}
                  {trip.status === "PLANNED" && operator && (
                    <button
                      className="button danger"
                      disabled={working}
                      onClick={() =>
                        void run(
                          `trips/${trip.id}`,
                          { status: "CANCELLED" },
                          "PATCH",
                        )
                      }
                    >
                      Cancel plan
                    </button>
                  )}
                </div>
              )}
            </Panel>
          </div>
        ) : (
          <Panel>
            <div className="enterprise-empty">
              <Navigation size={40} />
              <h2>Your delivery control room is ready</h2>
              <p>
                Allocate sales orders, add a vehicle and plan your first route.
              </p>
              {operator && (
                <button
                  className="button primary"
                  onClick={() => setForm("trip")}
                >
                  Plan a delivery trip
                </button>
              )}
            </div>
          </Panel>
        ))}
      {form === "trip" && <TripEditor onClose={() => setForm("")} />}{" "}
      {form && form !== "trip" && (
        <BusinessForm
          mode={form.split(":")[0]}
          targetId={form.split(":")[1]}
          onClose={() => setForm("")}
        />
      )}
    </>
  );
}
