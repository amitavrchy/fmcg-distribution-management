"use client";
import { useState } from "react";
import { RefreshCw, CloudCheck, Wifi, WifiOff, Trash2 } from "lucide-react";
import { useApp } from "./provider";
import { Badge, Empty, Panel } from "./ui";
import { date, label } from "@/lib/format";
import { discard } from "@/lib/offline";
export function SyncCenter() {
  const { data, queue, online, sync, refresh } = useApp(),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="sync-summary">
        <span className="sync-symbol">
          {online ? <CloudCheck size={40} /> : <WifiOff size={40} />}
        </span>
        <div>
          <h2>
            {online
              ? "Connected and ready to sync"
              : "Your work stays with you"}
          </h2>
          <p>
            {queue.length
              ? `${queue.length} pending items on this device`
              : "All orders and collections have been sent to the server."}
          </p>
          <span className="cell-sub">
            Last snapshot: {date(data.serverTime, true)} · Price list v
            {data.prices?.version}
          </span>
        </div>
        <button
          className="button primary"
          disabled={!online || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await sync();
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw size={17} className={busy ? "spin" : ""} />
          {busy ? "Syncing…" : "Sync now"}
        </button>
      </div>
      <Panel
        title="Device outbox"
        subtitle="Every queued item keeps its original client ID to prevent duplicate orders and collections."
      >
        {queue.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type / client ID</th>
                  <th>Saved</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{label(item.type)}</strong>
                      <span className="cell-sub">{item.id}</span>
                    </td>
                    <td>{date(item.createdAt, true)}</td>
                    <td>
                      <Badge
                        value={item.error ? "NEEDS_ATTENTION" : "PENDING"}
                      />
                      {item.error && (
                        <span className="cell-sub warning wrap-cell">
                          {item.error}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="button small danger"
                        onClick={async () => {
                          if (
                            confirm(
                              "Discard this unsynced item? This cannot be undone.",
                            )
                          ) {
                            await discard(item.id);
                            await refresh();
                          }
                        }}
                      >
                        <Trash2 size={16} />
                        Discard
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="You’re all caught up"
            detail="New offline orders and collections will wait safely here until you reconnect."
          />
        )}
      </Panel>
      <div className="callout">
        If an item reports a stale price list, refresh the workspace and create
        a replacement with current prices, then discard the old queued item.
        Credit conflicts become orders awaiting manager approval.
      </div>
    </>
  );
}
