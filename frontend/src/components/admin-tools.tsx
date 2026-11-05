"use client";
import { useState } from "react";
import { useApp } from "./provider";
import { Field, Modal, SimpleForm } from "./ui";
export function AdminTools({ pricing = false }: { pricing?: boolean }) {
  const { user, data, mutate } = useApp(),
    [mode, setMode] = useState(""),
    [role, setRole] = useState("SR"),
    [metadataSku, setMetadataSku] = useState(data.skus[0]?.id || "");
  if (user.role !== "COMPANY_ADMIN") return null;
  return (
    <>
      <div className="admin-tools">
        {(pricing
          ? [
              ["prices", "Update trade price"],
              ["sku-metadata", "Product logistics & barcode"],
            ]
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
                : mode === "sku-metadata"
                  ? "Product logistics & barcode"
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
                    : mode === "sku-metadata"
                      ? {
                          skuId: f.get("skuId"),
                          weightGrams: Number(f.get("weight")),
                          reorderLevel: Number(f.get("reorder")),
                          barcode: f.get("barcode"),
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
                {mode === "prices" && (
                  <p className="callout">
                    Publishing creates a new price list version. Unsynced orders
                    with the previous version will require review.
                  </p>
                )}
                <Field label="Product">
                  <select
                    name="skuId"
                    required
                    {...(mode === "sku-metadata"
                      ? {
                          value: metadataSku,
                          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                            setMetadataSku(e.target.value),
                        }
                      : {})}
                  >
                    {data.skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {mode === "sku-metadata" ? (
                  <>
                    <Field label="Unit weight (grams)">
                      <input
                        key={`weight-${metadataSku}`}
                        name="weight"
                        type="number"
                        min="1"
                        max="1000000"
                        required
                        defaultValue={
                          data.skus.find((s) => s.id === metadataSku)
                            ?.weightGrams || 500
                        }
                      />
                    </Field>
                    <Field label="Reorder threshold (units)">
                      <input
                        key={`reorder-${metadataSku}`}
                        name="reorder"
                        type="number"
                        min="0"
                        max="1000000"
                        defaultValue={
                          data.skus.find((s) => s.id === metadataSku)
                            ?.reorderLevel ?? 50
                        }
                        required
                      />
                    </Field>
                    <Field label="Barcode (optional)">
                      <input
                        key={`barcode-${metadataSku}`}
                        name="barcode"
                        maxLength={50}
                        defaultValue={
                          data.skus.find((s) => s.id === metadataSku)
                            ?.barcode || ""
                        }
                      />
                    </Field>
                  </>
                ) : (
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
                )}
              </>
            )}
          </SimpleForm>
        </Modal>
      )}
    </>
  );
}
