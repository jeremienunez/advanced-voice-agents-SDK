import type { MemoryStorePort } from "@voiceagentsdk/core/sdk";

export type RuntimeMemoryDriver = "local" | "redis";

export interface RedisRuntimeMemoryStoreOptions {
  defaultTtlSeconds?: number;
  namespace?: string;
  redisUrl: string;
}

export interface RuntimeMemoryStoreFactoryOptions {
  defaultTtlSeconds?: number;
  redisFactory?: (options: RedisRuntimeMemoryStoreOptions) => MemoryStorePort;
}
