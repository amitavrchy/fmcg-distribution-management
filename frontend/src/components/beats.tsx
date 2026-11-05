"use client";
import { useState } from "react";
import { MapPin, Navigation, CheckCircle2, Phone } from "lucide-react";
import { useApp } from "./provider";
import { Badge, Field, Modal, Panel, Progress, SimpleForm } from "./ui";
import { days, date } from "@/lib/format";
export function Beats({
  create,
  onCreated,
}: {
  create: boolean;
  onCreated: () => void;
}) {
  const { data, user, mutate, notify, online } = useApp(),
    [beat, setBeat] = useState(data.beats[0]?.id || ""),
    [outlet, setOutlet] = useState<string | null>(null),
    [locating, setLocating] = useState(false);
  const outlets = data.outlets.filter((o) => o.beatId === beat),
    visits = data.visits.filter(
      (v) => v.srId === user.id || user.role !== "SR",
    ),
    visited = outlets.filter((o) =>
      visits.some((v) => v.outletId === o.id && v.checkInAt),
    ).length;
  const canVisit = ["SR", "COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role);
  return (
    <>
      <div className="route-layout">
        <aside className="route-list">
          <span className="eyebrow">WEEKLY BEAT PLAN</span>
          {data.beats.map((b) => (
            <button
              key={b.id}
              className={`beat-choice ${b.id === beat ? "selected" : ""}`}
              onClick={() => setBeat(b.id)}
            >
              <span className="route-number">
                <Navigation size={20} />
              </span>
              <div>
                <strong>{b.name}</strong>
                <span>
                  {days[b.weekday]} ·{" "}
                  {data.outlets.filter((o) => o.beatId === b.id).length} outlets
                </span>
              </div>
            </button>
          ))}
          <div className="callout">
            <MapPin size={20} />
            <p>
              GPS check-ins help your team track route compliance. Locations
              outside 500m are flagged for review.
            </p>
          </div>
        </aside>
        <Panel
          title={data.beats.find((b) => b.id === beat)?.name || "Your route"}
          subtitle={`${data.weekday}, ${date(data.today + "T00:00:00+06:00")} · ${visited} of ${outlets.length} visited`}
        >
          <div className="route-progress">
            <Progress
              value={outlets.length ? (visited / outlets.length) * 100 : 0}
            />
          </div>
          <div className="visit-list">
            {outlets.map((o, i) => {
              const visit = visits.find((v) => v.outletId === o.id);
              return (
                <div className="visit-row" key={o.id}>
                  <span
                    className={`visit-number ${visit?.checkInAt ? "completed" : ""}`}
                  >
                    {visit?.checkInAt ? <CheckCircle2 size={19} /> : i + 1}
                  </span>
                  <div className="visit-info">
                    <h3>{o.name}</h3>
                    <p>
                      <MapPin size={14} />
                      {o.address}
                    </p>
                    <span className="cell-sub">
                      {o.owner} · <a href={`tel:${o.phone}`}>{o.phone}</a>
                    </span>
                  </div>
                  {visit?.checkInAt && (
                    <Badge
                      value={visit.anomaly ? "GPS_FLAGGED" : visit.callType}
                    />
                  )}
                  <button
                    className="button small"
                    disabled={!online || !canVisit}
                    onClick={() => setOutlet(o.id)}
                  >
                    {visit?.checkInAt ? "Update visit" : "Check in"}
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
      {outlet && (
        <Modal
          title={`Check in · ${data.outlets.find((o) => o.id === outlet)?.name}`}
          onClose={() => setOutlet(null)}
        >
          <p className="modal-description">
            Allow location access to record your check-in. Your raw coordinates
            are retained for visit verification.
          </p>
          <SimpleForm
            submit={locating ? "Locating…" : "Record GPS check-in"}
            onSubmit={async (f) => {
              setLocating(true);
              try {
                const position = await new Promise<GeolocationPosition>(
                  (resolve, reject) => {
                    if (!navigator.geolocation) {
                      reject(
                        new Error("Location is unavailable on this device"),
                      );
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      resolve,
                      () =>
                        reject(
                          new Error("Allow location access and try again."),
                        ),
                      { enableHighAccuracy: true, timeout: 15000 },
                    );
                  },
                );
                await mutate("sr/visits", {
                  outletId: outlet,
                  callType: f.get("callType"),
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  notes: f.get("notes"),
                });
                setOutlet(null);
              } finally {
                setLocating(false);
              }
            }}
          >
            <Field label="Call outcome">
              <select name="callType">
                <option value="PRODUCTIVE">Productive visit</option>
                <option value="ORDER">Order taken</option>
                <option value="NO_ORDER">No order</option>
                <option value="CLOSED">Outlet closed</option>
              </select>
            </Field>
            <Field label="Visit notes">
              <textarea name="notes" maxLength={500} />
            </Field>
          </SimpleForm>
        </Modal>
      )}
      {create && (
        <Modal title="Create beat" onClose={onCreated}>
          <SimpleForm
            onSubmit={async (f) => {
              await mutate("masters/beats", {
                name: f.get("name"),
                weekday: Number(f.get("weekday")),
                territoryId: f.get("territoryId"),
              });
              onCreated();
            }}
          >
            <Field label="Beat name">
              <input name="name" required maxLength={200} />
            </Field>
            <Field label="Territory">
              <select name="territoryId">
                {data.territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Visit day">
              <select name="weekday">
                {days.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </SimpleForm>
        </Modal>
      )}
    </>
  );
}
