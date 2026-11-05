"use client";
import { useState } from "react";
import { TicketPercent, CalendarDays, Gift } from "lucide-react";
import { useApp } from "./provider";
import { Badge, Empty, Field, Modal, Panel, SimpleForm } from "./ui";
import { money, date } from "@/lib/format";
export function Schemes({
  create,
  onCreated,
}: {
  create: boolean;
  onCreated: () => void;
}) {
  const { data, mutate } = useApp(),
    [type, setType] = useState("PERCENT");
  return (
    <>
      <div className="scheme-grid">
        {data.schemes.map((s) => (
          <Panel key={s.id} className="scheme-card">
            <div className="scheme-top">
              <span className="scheme-icon">
                {s.rules.type === "FREE" ? (
                  <Gift size={27} />
                ) : (
                  <TicketPercent size={27} />
                )}
              </span>
              <Badge
                value={
                  s.active && new Date(s.endsOn) > new Date()
                    ? "ACTIVE"
                    : "EXPIRED"
                }
              />
            </div>
            <span className="eyebrow">
              {s.rules.type} SCHEME · PRIORITY {s.priority}
            </span>
            <h2>{s.name}</h2>
            <p>
              {s.rules.type === "PERCENT"
                ? `${s.rules.value}% off orders over ${money(s.rules.minMinor || 0)}`
                : s.rules.type === "FREE"
                  ? `Buy ${s.rules.buyQty}, get ${s.rules.freeQty} free · ${data.skus.find((p) => p.id === s.rules.skuId)?.name}`
                  : s.rules.type === "COMBO"
                    ? `${money(s.rules.value || 0)} off qualifying product combos`
                    : `${money(s.rules.value || 0)} off eligible invoices`}
            </p>
            <div className="scheme-dates">
              <CalendarDays size={17} />
              {date(s.startsOn)} — {date(s.endsOn)}
            </div>
            <span className="cell-sub">
              Applied automatically to eligible orders. Free goods depend on
              stock.
            </span>
          </Panel>
        ))}
      </div>
      {!data.schemes.length && <Empty title="No trade schemes yet" />}
      {create && (
        <Modal title="Create trade scheme" onClose={onCreated}>
          <SimpleForm
            onSubmit={async (f) => {
              const rules =
                type === "FREE"
                  ? {
                      type,
                      skuId: f.get("skuId"),
                      buyQty: Number(f.get("buyQty")),
                      freeQty: Number(f.get("freeQty")),
                    }
                  : type === "COMBO"
                    ? {
                        type,
                        requires: f.getAll("requires"),
                        value: Math.round(Number(f.get("value")) * 100),
                        minMinor: Math.round(Number(f.get("min")) * 100),
                      }
                    : {
                        type,
                        value:
                          type === "PERCENT"
                            ? Number(f.get("value"))
                            : Math.round(Number(f.get("value")) * 100),
                        minMinor: Math.round(Number(f.get("min")) * 100),
                      };
              await mutate("masters/schemes", {
                name: f.get("name"),
                priority: Number(f.get("priority")),
                startsOn: new Date(
                  `${f.get("start")}T00:00:00+06:00`,
                ).toISOString(),
                endsOn: new Date(
                  `${f.get("end")}T23:59:59+06:00`,
                ).toISOString(),
                rules,
              });
              onCreated();
            }}
          >
            <Field label="Scheme name">
              <input name="name" required maxLength={200} />
            </Field>
            <Field label="Rule type">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {["PERCENT", "AMOUNT", "FREE", "COMBO"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Start date">
              <input
                name="start"
                type="date"
                required
                defaultValue={data.today}
              />
            </Field>
            <Field label="End date">
              <input name="end" type="date" required min={data.today} />
            </Field>
            <Field label="Priority (lower first)">
              <input
                name="priority"
                type="number"
                min="0"
                max="10000"
                defaultValue="100"
                required
              />
            </Field>
            {type === "FREE" ? (
              <>
                <Field label="Qualifying product">
                  <select name="skuId">
                    {data.skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Buy quantity">
                  <input type="number" min="1" name="buyQty" required />
                </Field>
                <Field label="Free quantity">
                  <input type="number" min="1" name="freeQty" required />
                </Field>
              </>
            ) : (
              <>
                <Field
                  label={type === "PERCENT" ? "Discount (%)" : "Discount (BDT)"}
                >
                  <input
                    name="value"
                    type="number"
                    min="0"
                    max={type === "PERCENT" ? 100 : 20000000}
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="Minimum invoice (BDT)">
                  <input
                    name="min"
                    type="number"
                    min="0"
                    defaultValue="0"
                    required
                  />
                </Field>
                {type === "COMBO" && (
                  <Field label="Required products (select at least two)">
                    <select name="requires" multiple required>
                      {data.skus.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}
          </SimpleForm>
        </Modal>
      )}
    </>
  );
}
