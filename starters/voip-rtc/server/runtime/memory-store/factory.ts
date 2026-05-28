import { createInMemoryMemoryStore } from "@voiceagentsdk/core/server";
import type { MemoryStorePort } from "@voiceagentsdk/core/sdk";
import { RedisRuntimeMemoryStore } from "./redis-store.js";
import type {
  RedisRuntimeMemoryStoreOptions,
  RuntimeMemoryDriver,
  RuntimeMemoryStoreFactoryOptions,
} from "./types.js";

const DEFAULT_RUNTIME_MEMORY_TTL_SECONDS = 86_400;

export function createRuntimeMemoryStoreFromEnv(
  env: Record<string, string | undefined> = Bun.env,
  options: RuntimeMemoryStoreFactoryOptions = {},
): MemoryStorePort {
  const defaultTtlSeconds = ttlSeconds(
    env,
    options.defaultTtlSeconds ?? DEFAULT_RUNTIME_MEMORY_TTL_SECONDS,
  );
  if (memoryDriver(env) === "redis") {
    const redisOptions = redisMemoryOptions(env, defaultTtlSeconds);
    return options.redisFactory?.(redisOptions) ??
      new RedisRuntimeMemoryStore(redisOptions);
  }
  return createInMemoryMemoryStore({ defaultTtlSeconds });
}

function memoryDriver(
  env: Record<string, string | undefined>,
): RuntimeMemoryDriver {
  return env.AGENT_RUNTIME_MEMORY_DRIVER === "redis" ? "redis" : "local";
}

function redisMemoryOptions(
  env: Record<string, string | undefined>,
  defaultTtlSeconds: number | undefined,
): RedisRuntimeMemoryStoreOptions {
  return {
    defaultTtlSeconds,
    namespace: env.AGENT_RUNTIME_MEMORY_NAMESPACE,
    redisUrl: requiredRedisUrl(env),
  };
}

function requiredRedisUrl(env: Record<string, string | undefined>): string {
  const redisUrl = env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error("REDIS_URL is required for redis runtime memory driver");
  }
  return redisUrl;
}

function ttlSeconds(
  env: Record<string, string | undefined>,
  fallback: number | undefined,
): number | undefined {
  const raw = env.AGENT_RUNTIME_MEMORY_TTL_SECONDS?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
