export type TemporalMemoryDriver = "local" | "redis";

export interface TemporalMemoryStoreOptions {
  defaultTtlSeconds?: number;
}

export interface RedisTemporalMemoryStoreOptions extends TemporalMemoryStoreOptions {
  namespace?: string;
  redisUrl: string;
}
