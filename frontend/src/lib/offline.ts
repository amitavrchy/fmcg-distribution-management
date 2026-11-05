import { openDB } from "idb";
import type { Snapshot } from "./types";
import { api } from "./api";
export type QueueItem = {
  id: string;
  ownerId: string;
  type: "ORDER" | "COLLECTION";
  payload: unknown;
  createdAt: string;
  error?: string;
};
const db = () =>
  openDB("deshflow-offline", 1, {
    upgrade(d) {
      d.createObjectStore("cache");
      d.createObjectStore("queue", { keyPath: "id" });
    },
  });
export async function saveSnapshot(userId: string, data: Snapshot) {
  await (await db()).put("cache", data, userId);
}
export async function cachedSnapshot(
  userId: string,
): Promise<Snapshot | undefined> {
  return (await db()).get("cache", userId);
}
export async function enqueue(item: QueueItem) {
  await (await db()).put("queue", item);
}
export async function queueItems(ownerId: string): Promise<QueueItem[]> {
  return (await (await db()).getAll("queue")).filter(
    (i: QueueItem) => i.ownerId === ownerId,
  );
}
export async function discard(id: string) {
  await (await db()).delete("queue", id);
}
let syncing = false;
export async function synchronize(ownerId: string) {
  if (syncing) return;
  syncing = true;
  try {
    const all = await queueItems(ownerId);
    if (!all.length) return;
    for (let offset = 0; offset < all.length; offset += 100) {
      const items = all.slice(offset, offset + 100);
      const { results } = await api<{
        results: { id: string; ok: boolean; error?: string }[];
      }>("sync/push", { items });
      for (const r of results) {
        const item = items.find((i) => i.id === r.id)!;
        if (r.ok) await discard(r.id);
        else await enqueue({ ...item, error: r.error });
      }
    }
  } finally {
    syncing = false;
  }
}
