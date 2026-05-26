import { Redis } from "@upstash/redis";
import { REDIS_PREFIX } from "./constants";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required");
    }
    redis = new Redis({ url, token });
  }
  return redis;
}

export function key(suffix: string): string {
  const normalized = suffix.startsWith(REDIS_PREFIX)
    ? suffix
    : `${REDIS_PREFIX}${suffix}`;
  return normalized;
}

export async function getJson<T>(suffix: string): Promise<T | null> {
  const data = await getRedis().get<string>(key(suffix));
  if (data === null || data === undefined) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }
  return data as T;
}

export async function setJson(
  suffix: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  const k = key(suffix);
  if (ttlSeconds) {
    await getRedis().set(k, JSON.stringify(value), { ex: ttlSeconds });
  } else {
    await getRedis().set(k, JSON.stringify(value));
  }
}

export async function listNewsKeys(): Promise<{ key: string; value: unknown }[]> {
  const r = getRedis();
  const pattern = `${REDIS_PREFIX}*`;
  let cursor = 0;
  const keys: string[] = [];

  do {
    const result = await r.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(result[0]);
    keys.push(...(result[1] as string[]));
  } while (cursor !== 0);

  const entries: { key: string; value: unknown }[] = [];
  for (const k of keys) {
    const value = await r.get(k);
    entries.push({ key: k, value });
  }
  return entries;
}
