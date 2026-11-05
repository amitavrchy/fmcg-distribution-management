"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useApp } from "../provider";
import { api } from "@/lib/api";
import type { EnterpriseSnapshot } from "@/lib/enterprise";
type ContextType = {
  data: EnterpriseSnapshot;
  reload: () => Promise<void>;
  act: (path: string, body: unknown, method?: string) => Promise<void>;
  run: (path: string, body: unknown, method?: string) => Promise<void>;
  working: boolean;
};
const Context = createContext<ContextType | null>(null);
export function useEnterprise() {
  const c = useContext(Context);
  if (!c) throw new Error("Enterprise provider is missing");
  return c;
}
export function EnterpriseProvider({ children }: { children: ReactNode }) {
  const app = useApp(),
    [data, setData] = useState<EnterpriseSnapshot | null>(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const reload = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const d = await api<EnterpriseSnapshot>("enterprise/snapshot");
      setData(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load operations");
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload, app.data.serverTime, app.online]);
  const act = async (path: string, body: unknown, method?: string) => {
    if (!navigator.onLine)
      throw new Error(
        "Connect to the workspace before posting this operation. Offline sales orders and collections remain available.",
      );
    await api(`enterprise/${path}`, body, method);
    await app.refresh();
    await reload();
    app.notify("Operation posted successfully");
  };
  const run = async (path: string, body: unknown, method?: string) => {
    if (working) return;
    setWorking(true);
    try {
      await act(path, body, method);
    } catch (e) {
      app.notify(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setWorking(false);
    }
  };
  if (!app.online && !data)
    return (
      <div className="callout">
        Connect to the workspace to load advanced operations. Offline orders and
        collections remain available from the standard workspace.
      </div>
    );
  if (error && !data)
    return (
      <div role="alert" className="empty">
        <h2>Operations could not load</h2>
        <p>{error}</p>
        <button className="button" onClick={() => void reload()}>
          Try again
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="enterprise-loading">
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton" />
        <p>Loading operational control center…</p>
      </div>
    );
  return (
    <Context.Provider value={{ data, reload, act, run, working }}>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {children}
    </Context.Provider>
  );
}
