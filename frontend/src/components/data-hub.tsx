"use client";
import { useState } from "react";
import { FileUp, Download, CheckCircle2 } from "lucide-react";
import { useApp } from "./provider";
import { api } from "@/lib/api";
import { exportCsv } from "@/lib/export";
import { Badge, Panel } from "./ui";
type Preview = {
  rows: {
    row: number;
    code: string;
    name: string;
    beat: string;
    status: string;
    errors: string[];
  }[];
  total: number;
  ready: number;
  skipped: number;
  errors: number;
};
export function DataHub() {
  const { user, data, refresh, notify } = useApp(),
    [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!["COMPANY_ADMIN", "AREA_MANAGER"].includes(user.role)) return null;
  return (
    <Panel
      title="Outlet import studio"
      subtitle="Validate CSV before committing. Existing beat/code pairs are skipped without overwriting."
    >
      <div className="import-studio">
        <div className="import-toolbar">
          <label className="button">
            <FileUp size={17} />
            Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="file-input"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 250000) {
                  setError("Choose a CSV smaller than 250 KB");
                  return;
                }
                setCsv(await f.text());
                setPreview(null);
                setError("");
              }}
            />
          </label>
          <button
            className="button"
            onClick={() =>
              exportCsv("outlet-import-template", [
                {
                  Code: "OUT-NEW-001",
                  Name: "New Retail Outlet",
                  Owner: "Retail Owner",
                  Phone: "01712345678",
                  Address: "Mirpur, Dhaka",
                  Beat: data.beats[0]?.name || "Beat name",
                  CreditBDT: 50000,
                },
              ])
            }
          >
            <Download size={17} />
            Download template
          </button>
        </div>
        <textarea
          aria-label="CSV import contents"
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
          placeholder="Code,Name,Owner,Phone,Address,Beat,CreditBDT"
          className="csv-editor"
          maxLength={250000}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="import-toolbar">
          <button
            className="button"
            disabled={busy || !csv}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setPreview(
                  await api("enterprise/imports/outlets/preview", { csv }),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Validation failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Validate file
          </button>
          {preview && (
            <>
              <span>
                {preview.ready} ready · {preview.skipped} skipped ·{" "}
                {preview.errors} errors
              </span>
              <button
                className="button primary"
                disabled={busy || !!preview.errors || !preview.ready}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const r = await api<{ imported: number }>(
                      "enterprise/imports/outlets/apply",
                      { csv },
                    );
                    notify(`${r.imported} outlets imported`);
                    await refresh();
                    setPreview(null);
                    setCsv("");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Import failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <CheckCircle2 size={17} />
                Import validated rows
              </button>
            </>
          )}
        </div>
      </div>
      {preview && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Row</th>
                <th>Outlet</th>
                <th>Beat</th>
                <th>Validation</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td>
                    <strong>{r.name}</strong>
                    <span className="cell-sub">{r.code}</span>
                  </td>
                  <td>{r.beat}</td>
                  <td>
                    <Badge value={r.status} />
                    {r.errors.map((e) => (
                      <span key={e} className="cell-sub warning wrap-cell">
                        {e}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
