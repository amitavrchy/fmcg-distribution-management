import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
@Injectable()
export class Cache implements OnModuleDestroy {
  private redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      })
    : null;
  constructor() {
    this.redis?.on("error", () => {});
    void this.redis?.connect().catch(() => {});
  }
  async read<T>(key: string, load: () => Promise<T>, ttl = 30): Promise<T> {
    const version =
      (await this.redis?.get("fmcg:cache-version").catch(() => null)) || "0";
    const cacheKey = `fmcg:${version}:${key}`;
    const value = await this.redis?.get(cacheKey).catch(() => null);
    if (value) return JSON.parse(value) as T;
    const result = await load();
    await this.redis
      ?.set(cacheKey, JSON.stringify(result), "EX", ttl)
      .catch(() => {});
    return result;
  }
  async invalidate() {
    await this.redis?.incr("fmcg:cache-version").catch(() => {});
  }
  async onModuleDestroy() {
    this.redis?.disconnect();
  }
}
