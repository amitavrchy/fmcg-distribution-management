"use client";
import { useState } from "react";
import { ShieldCheck, Download, FileClock } from "lucide-react";
import { useApp } from "./provider";
import { Badge, Panel, Empty } from "./ui";
import { date, label } from "@/lib/format";
import { api } from "@/lib/api";
import { exportCsv } from "@/lib/export";
import { Field, Modal, SimpleForm } from "./ui";
import { DataHub } from "./data-hub";
type Audit = {
  id: string;
  actorId: string;
  action: string;
  entityId: string;
  createdAt: string;
};
export function Settings() {
  const [passwordForm, setPasswordForm] = useState(false);
  const { user, data, notify } = useApp(),
    [audit, setAudit] = useState<Audit[] | null>(null);
  return (
    <div className="settings-grid">
      <Panel
        title="Workspace preferences"
        subtitle="Your regional and operational configuration"
      >
        <dl className="settings-list">
          <div>
            <dt>Currency</dt>
            <dd>Bangladeshi Taka (BDT)</dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>Asia/Dhaka · UTC+06:00</dd>
          </div>
          <div>
            <dt>Display language</dt>
            <dd>English</dd>
          </div>
          <div>
            <dt>Active price list</dt>
            <dd>
              {data.prices?.name} · v{data.prices?.version}
            </dd>
          </div>
          <div>
            <dt>Device storage</dt>
            <dd>Offline orders, collections & snapshot</dd>
          </div>
        </dl>
      </Panel>
      <Panel
        title="Your account"
        subtitle="Permissions are enforced by your organization"
      >
        <div className="account-details">
          <span className="account-icon">
            <ShieldCheck size={32} />
          </span>
          <h3>{user.fullName}</h3>
          <p>{user.email}</p>
          <Badge value={user.role} />
          <div style={{ marginTop: 20 }}>
            <button className="button" onClick={() => setPasswordForm(true)}>
              Change password
            </button>
          </div>
        </div>
      </Panel>
      <Panel
        title="Data & accountability"
        subtitle="Export operational records and inspect your activity history"
      >
        <div className="settings-actions">
          <button
            className="button"
            onClick={() =>
              exportCsv(
                "outlets",
                data.outlets.map((o) => ({
                  Code: o.code,
                  Name: o.name,
                  Owner: o.owner,
                  Phone: o.phone,
                  Beat: o.beat.name,
                  CreditBDT: o.creditLimitMinor / 100,
                })),
              )
            }
          >
            <Download size={17} />
            Export outlet register
          </button>
          <button
            className="button"
            onClick={() =>
              exportCsv(
                "invoices",
                data.invoices.map((i) => ({
                  Invoice: i.number,
                  TotalBDT: i.totalMinor / 100,
                  PaidBDT: i.paidMinor / 100,
                  Status: i.status,
                })),
              )
            }
          >
            <Download size={17} />
            Export invoices
          </button>
          {["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role) && (
            <button
              className="button"
              onClick={async () => {
                try {
                  setAudit(await api<Audit[]>("audit"));
                } catch (e) {
                  notify(
                    e instanceof Error
                      ? e.message
                      : "Unable to load audit history",
                  );
                }
              }}
            >
              <FileClock size={17} />
              Load audit history
            </button>
          )}
        </div>
        {audit && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {label(a.action)}
                      <span className="cell-sub">{a.entityId}</span>
                    </td>
                    <td>
                      {data.users.find((u) => u.id === a.actorId)?.fullName ||
                        "Team member"}
                    </td>
                    <td>{date(a.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {passwordForm && (
        <Modal title="Change password" onClose={() => setPasswordForm(false)}>
          <SimpleForm
            submit="Update password & revoke other sessions"
            onSubmit={async (f) => {
              await api("auth/password", {
                currentPassword: f.get("current"),
                newPassword: f.get("next"),
              });
              setPasswordForm(false);
              notify("Password updated. Other sessions have been revoked.");
            }}
          >
            <Field label="Current password">
              <input
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="New password (12+ characters)">
              <input
                name="next"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </Field>
          </SimpleForm>
        </Modal>
      )}
      <DataHub />
    </div>
  );
}
