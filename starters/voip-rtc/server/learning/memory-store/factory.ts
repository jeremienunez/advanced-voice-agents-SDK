import type { TemporalMemoryStorePort } from "@voiceagentsdk/core/sdk";
import { LocalRedisTemporalMemoryStore } from "./local-store.js";
import { RedisTemporalMemoryStore } from "./redis-store.js";
import type {
  TemporalMemoryDriver,
  TemporalMemoryStoreOptions,
} from "./types.js";

export function createTemporalMemoryStoreFromEnv(
  env: Record<string, string | undefined> = Bun.env,
  options: TemporalMemoryStoreOptions = {},
): TemporalMemoryStorePort {
  if (memoryDriver(env) === "redis") {
    return new RedisTemporalMemoryStore({
      defaultTtlSeconds: options.defaultTtlSeconds,
      namespace: env.AGENT_LEARNING_MEMORY_NAMESPACE,
      redisUrl: requiredRedisUrl(env),
    });
  }
  return new LocalRedisTemporalMemoryStore(options);
}

function memoryDriver(env: Record<string, string | undefined>): TemporalMemoryDriver {
  return env.AGENT_LEARNING_MEMORY_DRIVER === "redis" ? "redis" : "local";
}

function requiredRedisUrl(env: Record<string, string | undefined>): string {
  const redisUrl = env.REDIS_URL?.trim();
  if (!redisUrl) throw new Error("REDIS_URL is required for redis learning memory driver");
  return redisUrl;
}
