"use client";
import { useState } from "react";
import { useApp } from "./provider";
import { Field, Modal, SimpleForm } from "./ui";
export function AdminTools({ pricing = false }: { pricing?: boolean }) {
  const { user, data, mutate } = useApp(),
    [mode, setMode] = useState(""),
    [role, setRole] = useState("SR");
  if (user.role !== "COMPANY_ADMIN") return null;
  return (
    <>
      <div className="admin-tools">
        {(pricing
          ? [["prices", "Update trade price"]]
          : [
              ["users", "Add team member"],
              ["territories", "Create territory"],
            ]
        ).map(([key, text]) => (
          <button className="button" key={key} onClick={() => setMode(key)}>
            {text}
          </button>
        ))}
      </div>
      {mode && (
        <Modal
          title={
            mode === "users"
              ? "Add team member"
              : mode === "territories"
                ? "Create territory"
                : "Publish trade price"
          }
          onClose={() => setMode("")}
        >
          <SimpleForm
            onSubmit={async (f) => {
              const body =
                mode === "users"
                  ? {
                      email: f.get("email"),
                      fullName: f.get("fullName"),
                      password: f.get("password"),
                      role,
                      territoryId: f.get("territoryId"),
                      distributorId:
                        role === "DISTRIBUTOR"
                          ? f.get("distributorId")
                          : undefined,
                    }
                  : mode === "territories"
                    ? {
                        region: f.get("region"),
                        area: f.get("area"),
                        name: f.get("name"),
                      }
                    : {
                        skuId: f.get("skuId"),
                        priceMinor: Math.round(Number(f.get("price")) * 100),
                      };
              await mutate(`admin/${mode}`, body);
              setMode("");
            }}
          >
            {mode === "users" ? (
              <>
                <Field label="Full name">
                  <input name="fullName" required maxLength={200} />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" required />
                </Field>
                <Field label="Initial password (12+ characters)">
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <Field label="Role">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {[
                      "SR",
                      "AREA_MANAGER",
                      "DISTRIBUTOR",
                      "ACCOUNTS",
                      "COMPANY_ADMIN",
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Territory">
                  <select name="territoryId" required>
                    {data.territories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {role === "DISTRIBUTOR" && (
                  <Field label="Distributor">
                    <select name="distributorId" required>
                      {data.distributors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            ) : mode === "territories" ? (
              <>
                {[
                  ["region", "Region name"],
                  ["area", "Area name"],
                  ["name", "Territory name"],
                ].map(([key, text]) => (
                  <Field key={key} label={text}>
                    <input name={key} required maxLength={200} />
                  </Field>
                ))}
              </>
            ) : (
              <>
                <p className="callout">
                  Publishing creates a new price list version. Unsynced orders
                  with the previous version will require review.
                </p>
                <Field label="Product">
                  <select name="skuId" required>
                    {data.skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="New trade price (BDT)">
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    max="20000000"
                    required
                  />
                </Field>
              </>
            )}
          </SimpleForm>
        </Modal>
      )}
    </>
  );
}
