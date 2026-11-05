"use client";
import { useState } from "react";
import { MapPin, Phone, Store, ArrowUpRight } from "lucide-react";
import { useApp } from "./provider";
import { Empty, Field, Modal, Panel, SearchBox, SimpleForm, Badge } from "./ui";
import { money, due as invoiceBalance } from "@/lib/format";
export function Outlets({
  create,
  onCreated,
}: {
  create: boolean;
  onCreated: () => void;
}) {
  const { data, user, mutate } = useApp(),
    [q, setQ] = useState(""),
    [beat, setBeat] = useState("ALL"),
    [selected, setSelected] = useState<string | null>(null);
  const outlets = data.outlets.filter(
    (o) =>
      (beat === "ALL" || o.beatId === beat) &&
      `${o.name} ${o.code} ${o.owner}`.toLowerCase().includes(q.toLowerCase()),
  );
  const item = data.outlets.find((o) => o.id === selected),
    canEdit = ["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role);
  return (
    <>
      <Panel>
        <div className="table-toolbar">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search outlet, owner or code…"
          />
          <select
            aria-label="Filter by beat"
            value={beat}
            onChange={(e) => setBeat(e.target.value)}
          >
            <option value="ALL">All beats</option>
            {data.beats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="muted">{outlets.length} outlets</span>
        </div>
      </Panel>
      <div className="outlet-grid">
        {outlets.map((o) => {
          const due = data.invoices
            .filter((i) => i.outletId === o.id)
            .reduce((s, i) => s + invoiceBalance(i), 0);
          return (
            <button
              className="outlet-card"
              key={o.id}
              onClick={() => setSelected(o.id)}
            >
              <div className="outlet-card-top">
                <span className="outlet-icon">
                  <Store size={23} />
                </span>
                <Badge value={o.channel} />
              </div>
              <h3>{o.name}</h3>
              <p>
                {o.code} · {o.owner}
              </p>
              <span className="outlet-address">
                <MapPin size={16} />
                {o.address}
              </span>
              <div className="outlet-card-bottom">
                <span>
                  <small>Outstanding</small>
                  <strong className={due ? "warning" : ""}>{money(due)}</strong>
                </span>
                <span className="outlet-beat">
                  {o.beat.name}
                  <ArrowUpRight size={16} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {!outlets.length && <Empty title="No outlets found" />}
      {create && (
        <Modal title="Add retail outlet" onClose={onCreated}>
          <SimpleForm
            onSubmit={async (f) => {
              await mutate("masters/outlets", {
                name: f.get("name"),
                code: f.get("code"),
                owner: f.get("owner"),
                phone: f.get("phone"),
                address: f.get("address"),
                beatId: f.get("beatId"),
                channel: f.get("channel"),
                creditLimitMinor: Math.round(Number(f.get("credit")) * 100),
              });
              onCreated();
            }}
          >
            {[
              ["name", "Outlet name"],
              ["code", "Outlet code"],
              ["owner", "Owner name"],
              ["phone", "Phone (01XXXXXXXXX)"],
              ["address", "Address"],
            ].map(([name, caption]) => (
              <Field key={name} label={caption}>
                <input
                  name={name}
                  required
                  maxLength={200}
                  {...(name === "phone"
                    ? { pattern: "01[0-9]{9}", type: "tel" }
                    : {})}
                />
              </Field>
            ))}
            <Field label="Beat">
              <select name="beatId" required>
                {data.beats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Channel">
              <select name="channel">
                <option>GENERAL</option>
                <option>PHARMACY</option>
                <option>HOTEL</option>
              </select>
            </Field>
            <Field label="Credit limit (BDT)">
              <input
                type="number"
                name="credit"
                min="0"
                max="20000000"
                defaultValue="50000"
                required
              />
            </Field>
          </SimpleForm>
        </Modal>
      )}
      {item && (
        <Modal title={item.name} onClose={() => setSelected(null)}>
          <div className="detail-overview">
            <div>
              <p>
                {item.code} · {item.owner}
              </p>
              <p>
                <Phone size={16} />{" "}
                <a href={`tel:${item.phone}`}>{item.phone}</a>
              </p>
              <p>{item.address}</p>
            </div>
            <Badge value={item.channel} />
          </div>
          <div className="mini-stats">
            <div>
              <span>Credit limit</span>
              <strong>{money(item.creditLimitMinor)}</strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>
                {money(
                  data.invoices
                    .filter((i) => i.outletId === item.id)
                    .reduce((s, i) => s + invoiceBalance(i), 0),
                )}
              </strong>
            </div>
          </div>
          {canEdit && (
            <SimpleForm
              submit="Update beat & credit"
              onSubmit={async (f) => {
                await mutate(
                  `outlets/${item.id}`,
                  {
                    beatId: f.get("beatId"),
                    creditLimitMinor: Math.round(Number(f.get("credit")) * 100),
                    paymentTermsDays: Number(f.get("terms")),
                    segment: f.get("segment"),
                    ...(f.get("lat") ? { lat: Number(f.get("lat")) } : {}),
                    ...(f.get("lng") ? { lng: Number(f.get("lng")) } : {}),
                  },
                  "PATCH",
                );
                setSelected(null);
              }}
            >
              <Field label="Assigned beat">
                <select name="beatId" defaultValue={item.beatId}>
                  {data.beats.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Credit limit (BDT)">
                <input
                  name="credit"
                  type="number"
                  min="0"
                  max="20000000"
                  defaultValue={item.creditLimitMinor / 100}
                  required
                />
              </Field>
              <Field label="Payment terms (days)">
                <input
                  name="terms"
                  type="number"
                  min="0"
                  max="365"
                  defaultValue={item.paymentTermsDays ?? 30}
                  required
                />
              </Field>
              <Field label="Account segment">
                <select
                  name="segment"
                  defaultValue={item.segment || "STANDARD"}
                >
                  {["STANDARD", "KEY_ACCOUNT", "GROWTH", "AT_RISK"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Latitude">
                <input
                  name="lat"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  defaultValue={item.lat ?? ""}
                />
              </Field>
              <Field label="Longitude">
                <input
                  name="lng"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  defaultValue={item.lng ?? ""}
                />
              </Field>
            </SimpleForm>
          )}
        </Modal>
      )}
    </>
  );
}
