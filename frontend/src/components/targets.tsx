"use client";
import { useState } from "react";
import { Target, Play } from "lucide-react";
import { useApp } from "./provider";
import { Badge, Empty, Field, Modal, Panel, Progress, SimpleForm } from "./ui";
import { money } from "@/lib/format";
export function Targets({
  create,
  onCreated,
}: {
  create: boolean;
  onCreated: () => void;
}) {
  const { data, user, mutate, notify } = useApp(),
    [month, setMonth] = useState(data.today.slice(0, 7)),
    [busy, setBusy] = useState(false);
  const targets = data.targets.filter((t) => t.periodYm === month);
  return (
    <>
      <Panel
        title="Monthly performance"
        subtitle="Delivered invoice value against your team’s sales targets"
        action={
          <input
            type="month"
            aria-label="Target month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sales representative</th>
                <th>Monthly target</th>
                <th>Delivered sales</th>
                <th>Achievement</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => {
                const sales = data.orders
                    .filter(
                      (o) =>
                        o.srId === t.srId &&
                        o.status === "DELIVERED" &&
                        o.delivery?.deliveredAt?.slice(0, 7) === month,
                    )
                    .reduce(
                      (s, o) => s + (o.delivery?.invoice?.totalMinor || 0),
                      0,
                    ),
                  pct = t.targetMinor ? (sales / t.targetMinor) * 100 : 0;
                return (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.sr.fullName}</strong>
                      <span className="cell-sub">{t.periodYm}</span>
                    </td>
                    <td>{money(t.targetMinor)}</td>
                    <td className="numeric">{money(sales)}</td>
                    <td>
                      <div className="achievement">
                        <Progress value={pct} />
                        <strong>{pct.toFixed(1)}%</strong>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!targets.length && (
          <Empty
            title="No targets set for this month"
            detail="Set a target to give your sales team a clear direction."
          />
        )}
      </Panel>
      <Panel
        title="Incentive runs"
        subtitle="80% achievement → 1% · 100% → 2% · 120% → 2.5%, plus call and focus bonuses"
        action={
          user.role === "COMPANY_ADMIN" && (
            <button
              className="button primary small"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await mutate("incentives/runs", { periodYm: month });
                } catch (e) {
                  notify(
                    e instanceof Error
                      ? e.message
                      : "Unable to calculate incentives",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Play size={15} />
              {busy ? "Calculating…" : "Calculate month"}
            </button>
          )
        }
      >
        {data.runs.length ? (
          data.runs.map((run) => (
            <div className="incentive-run" key={run.id}>
              <div className="run-heading">
                <strong>{run.periodYm}</strong>
                <Badge value={run.status} />
                {user.role === "COMPANY_ADMIN" && run.status !== "PAID" && (
                  <button
                    className="button small"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await mutate(
                          `incentives/runs/${run.id}`,
                          {
                            status:
                              run.status === "CALCULATED" ? "APPROVED" : "PAID",
                          },
                          "PATCH",
                        );
                      } catch (e) {
                        notify(
                          e instanceof Error
                            ? e.message
                            : "Unable to update run",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {run.status === "CALCULATED"
                      ? "Approve & lock"
                      : "Mark paid"}
                  </button>
                )}
              </div>
              {run.results.map((r) => (
                <div className="run-result" key={r.srId}>
                  <span>{r.fullName}</span>
                  <span>
                    {(r.achievementBps / 100).toFixed(1)}% achievement
                  </span>
                  <strong>{money(r.incentiveMinor)}</strong>
                </div>
              ))}
            </div>
          ))
        ) : (
          <Empty
            title="No incentive runs yet"
            detail={
              user.role === "COMPANY_ADMIN"
                ? "Calculate a month to review and approve incentives."
                : "Your company administrator calculates and approves monthly incentives."
            }
          />
        )}
      </Panel>
      {create && (
        <Modal title="Set monthly target" onClose={onCreated}>
          <SimpleForm
            onSubmit={async (f) => {
              await mutate("targets", {
                srId: f.get("srId"),
                periodYm: f.get("period"),
                targetMinor: Math.round(Number(f.get("amount")) * 100),
                focusSkuJson: f.getAll("focus"),
              });
              onCreated();
            }}
          >
            <Field label="Sales representative">
              <select name="srId" required>
                {data.users
                  .filter((u) => u.role === "SR")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Month">
              <input type="month" name="period" defaultValue={month} required />
            </Field>
            <Field label="Sales target (BDT)">
              <input
                name="amount"
                type="number"
                min="1"
                max="20000000"
                required
              />
            </Field>
            <Field label="Focus products (optional)">
              <select name="focus" multiple>
                {data.skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
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
