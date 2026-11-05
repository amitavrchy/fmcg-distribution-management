"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io } from "socket.io-client";
import { api, ApiError } from "@/lib/api";
import {
  cachedSnapshot,
  saveSnapshot,
  queueItems,
  synchronize,
} from "@/lib/offline";
import type { QueueItem } from "@/lib/offline";
import type { Actor, Snapshot } from "@/lib/types";
type State = {
  user: Actor;
  data: Snapshot;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
  mutate: (path: string, body: unknown, method?: string) => Promise<void>;
  queue: QueueItem[];
  online: boolean;
  sync: () => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<State | null>(null);
export function useApp() {
  const c = useContext(Context);
  if (!c) throw new Error("App provider missing");
  return c;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Actor | null>(null),
    [data, setData] = useState<Snapshot | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [queue, setQueue] = useState<QueueItem[]>([]),
    [online, setOnline] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((s: string) => {
    setToast(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  const refresh = useCallback(async () => {
    if (!user) return;
    setQueue(await queueItems(user.id));
    if (!navigator.onLine) return;
    try {
      const d = await api<Snapshot>("snapshot");
      setData(d);
      await saveSnapshot(user.id, d);
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        localStorage.removeItem("deshflow-user");
        window.location.href = "/login";
      } else throw e;
    }
  }, [user]);
  const sync = useCallback(async () => {
    if (!user) return;
    try {
      await synchronize(user.id);
      await refresh();
      notify("Sync complete. Review any items that need attention.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Unable to sync");
    }
  }, [user, refresh, notify]);
  useEffect(() => {
    let live = true;
    async function start() {
      try {
        const u = await api<Actor>("auth/me");
        if (!live) return;
        setUser(u);
        localStorage.setItem("deshflow-user", JSON.stringify(u));
        const d = await api<Snapshot>("snapshot");
        if (!live) return;
        setData(d);
        await saveSnapshot(u.id, d);
        setQueue(await queueItems(u.id));
      } catch (e) {
        const saved = localStorage.getItem("deshflow-user");
        if (!navigator.onLine && saved) {
          const u = JSON.parse(saved) as Actor;
          const d = await cachedSnapshot(u.id);
          if (d) {
            setUser(u);
            setData(d);
            setQueue(await queueItems(u.id));
          } else
            setError("Open the workspace online once before using it offline.");
        } else if (e instanceof ApiError && e.status === 401) {
          window.location.replace("/login");
        } else
          setError(
            e instanceof Error
              ? e.message
              : "Could not connect to the workspace",
          );
      } finally {
        setReady(true);
      }
    }
    void start();
    setOnline(navigator.onLine);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      live = false;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:4000",
      { withCredentials: true },
    );
    socket.on("refresh", () => void refresh().catch(() => {}));
    return () => {
      socket.disconnect();
    };
  }, [user, refresh]);
  useEffect(() => {
    if (online && user)
      void synchronize(user.id)
        .then(refresh)
        .catch(() => {});
  }, [online, user, refresh]);
  const mutate = async (path: string, body: unknown, method?: string) => {
    await api(path, body, method);
    await refresh();
    notify("Changes saved successfully");
  };
  const logout = async () => {
    await api("auth/logout", {});
    localStorage.removeItem("deshflow-user");
    window.location.href = "/login";
  };
  if (!ready)
    return (
      <div className="boot">
        <div className="brand-symbol">d</div>
        <p>Opening your workspace…</p>
      </div>
    );
  if (error && !data)
    return (
      <div className="boot">
        <h1>We couldn’t open your workspace</h1>
        <p>{error}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!user || !data) return null;
  return (
    <Context.Provider
      value={{
        user,
        data,
        refresh,
        notify,
        mutate,
        queue,
        online,
        sync,
        logout,
      }}
    >
      {children}
      {toast && (
        <div role="status" className="toast">
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
