"use client";
import { MapPin, Users, Building2 } from "lucide-react";
import { useApp } from "./provider";
import { Badge, Field, Modal, Panel, SimpleForm } from "./ui";
import { initials } from "@/lib/format";
import { AdminTools } from "./admin-tools";
export function Team({
  create,
  onCreated,
}: {
  create: boolean;
  onCreated: () => void;
}) {
  const { data, mutate } = useApp();
  return (
    <>
      <AdminTools />
      <div className="territory-grid">
        {data.territories.map((t) => (
          <Panel key={t.id}>
            <div className="territory-icon">
              <MapPin size={26} />
            </div>
            <span className="eyebrow">{t.area.region.name}</span>
            <h2>{t.name}</h2>
            <p className="muted">{t.area.name} area</p>
            <div className="territory-meta">
              <span>
                {data.beats.filter((b) => b.territoryId === t.id).length} beats
              </span>
              <span>
                {data.users.filter((u) => u.territoryId === t.id).length} team
                members
              </span>
            </div>
          </Panel>
        ))}
      </div>
      <Panel
        title="Your team"
        subtitle="People connected to your distribution territory"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Territory</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="product-name">
                      <span className="avatar">{initials(u.fullName)}</span>
                      <strong>{u.fullName}</strong>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <Badge value={u.role} />
                  </td>
                  <td>
                    {data.territories.find((t) => t.id === u.territoryId)
                      ?.name || "Company-wide"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Distribution partners"
        subtitle="Warehouses fulfilling orders across your network"
      >
        <div className="partner-grid">
          {data.distributors.map((d) => (
            <div className="partner-card" key={d.id}>
              <span className="outlet-icon">
                <Building2 size={25} />
              </span>
              <div>
                <h3>{d.name}</h3>
                <p>
                  {d.code} ·{" "}
                  {data.territories.find((t) => t.id === d.territoryId)?.name}
                </p>
              </div>
              <Badge value="ACTIVE" />
            </div>
          ))}
        </div>
      </Panel>
      {create && (
        <Modal title="Add distribution partner" onClose={onCreated}>
          <SimpleForm
            onSubmit={async (f) => {
              await mutate("masters/distributors", {
                name: f.get("name"),
                code: f.get("code"),
                territoryId: f.get("territoryId"),
              });
              onCreated();
            }}
          >
            <Field label="Partner name">
              <input name="name" required maxLength={200} />
            </Field>
            <Field label="Distributor code">
              <input name="code" required maxLength={200} />
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
          </SimpleForm>
        </Modal>
      )}
    </>
  );
}
