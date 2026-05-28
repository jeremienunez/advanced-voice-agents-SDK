import { createServer } from "node:net";
import {
  createTemporalMemoryStoreFromEnv,
  RedisTemporalMemoryStore,
} from "../server/learning/memory-store.js";
import { assert, assertThrows } from "./shared/assertions.js";

const redis = await startEphemeralRedis();

try {
  const results = [
    await scenarioRedisMemoryPersistsAcrossAdapters(redis.url),
    await scenarioRedisMemoryHonorsRealTtl(redis.url),
    await scenarioMemoryFactoryIsEnvSelected(redis.url),
  ];
  console.log(JSON.stringify({ status: "ok", results }, null, 2));
} finally {
  await docker(["rm", "-f", redis.containerName], { allowFailure: true });
}

async function scenarioRedisMemoryPersistsAcrossAdapters(redisUrl: string): Promise<string> {
  const scope = { tenantId: "tenant-a", agentId: "agent-a", userId: "user-a" };
  const writer = redisStore(redisUrl, "bdd-persist");
  const reader = redisStore(redisUrl, "bdd-persist");

  const [written] = await writer.write({
    scope,
    ttlSeconds: 60,
    records: [
      {
        kind: "preference",
        text: "User preference: concise Redis-backed memory",
        sourceSessionId: "session-redis-a",
      },
    ],
  });

  const scoped = await reader.list(scope);
  const otherUser = await reader.list({ ...scope, userId: "other-user" });

  await writer.close();
  await reader.close();

  assert(scoped.some((record) => record.id === written.id), "Redis memory must persist across adapter instances");
  assert(otherUser.length === 0, "Redis memory must isolate tenant/user scope");

  return "redis-memory-persists-across-adapters";
}

async function scenarioRedisMemoryHonorsRealTtl(redisUrl: string): Promise<string> {
  const scope = { tenantId: "tenant-a", agentId: "agent-ttl", userId: "user-a" };
  const store = redisStore(redisUrl, "bdd-ttl");

  const [written] = await store.write({
    scope,
    ttlSeconds: 1,
    records: [
      {
        kind: "summary",
        text: "Session summary: Redis TTL should expire this record.",
        sourceSessionId: "session-ttl-a",
      },
    ],
  });

  assert(Boolean(written.expiresAt), "Redis memory records must expose expiresAt");
  assert((await store.list(scope)).length === 1, "Redis memory must be visible before TTL");

  await waitFor(async () => (await store.list(scope)).length === 0);
  await store.close();

  return "redis-memory-honors-real-ttl";
}

async function scenarioMemoryFactoryIsEnvSelected(redisUrl: string): Promise<string> {
  const local = createTemporalMemoryStoreFromEnv({
    AGENT_LEARNING_MEMORY_DRIVER: "local",
    REDIS_URL: redisUrl,
  });
  const redis = createTemporalMemoryStoreFromEnv({
    AGENT_LEARNING_MEMORY_DRIVER: "redis",
    REDIS_URL: redisUrl,
  });

  assert(local.constructor.name === "LocalRedisTemporalMemoryStore", "local memory driver must stay available");
  assert(redis instanceof RedisTemporalMemoryStore, "redis memory driver must create the production adapter");
  assertThrows(
    () => createTemporalMemoryStoreFromEnv({ AGENT_LEARNING_MEMORY_DRIVER: "redis" }),
    "REDIS_URL is required",
  );

  await redis.close();

  return "memory-factory-is-env-selected";
}

function redisStore(redisUrl: string, namespace: string): RedisTemporalMemoryStore {
  return new RedisTemporalMemoryStore({
    redisUrl,
    namespace,
    defaultTtlSeconds: 60,
  });
}

async function startEphemeralRedis(): Promise<{ containerName: string; url: string }> {
  const containerName = `voiceagentsdk-redis-bdd-${crypto.randomUUID()}`;
  const port = await findFreePort();
  await docker([
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-p",
    `127.0.0.1:${port}:6379`,
    "redis:7-alpine",
    "redis-server",
    "--save",
    "",
    "--appendonly",
    "no",
  ]);
  await waitForRedis(containerName);
  return { containerName, url: `redis://127.0.0.1:${port}/0` };
}

async function waitForRedis(containerName: string): Promise<void> {
  await waitFor(async () => {
    const proc = Bun.spawn(["docker", "exec", containerName, "redis-cli", "ping"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return (await proc.exited) === 0;
  });
}

async function waitFor(predicate: () => Promise<boolean>): Promise<void> {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > 10_000) {
      throw new Error("Timed out waiting for Redis BDD condition");
    }
    await Bun.sleep(100);
  }
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address?.port) {
        server.close(() => resolve(address.port));
        return;
      }
      server.close(() => reject(new Error("Unable to allocate a free port")));
    });
    server.on("error", reject);
  });
}

async function docker(args: string[], options?: { allowFailure?: boolean }): Promise<void> {
  const proc = Bun.spawn(["docker", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stderr, code] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0 && !options?.allowFailure) {
    throw new Error(`docker ${args.join(" ")} failed with ${code}: ${stderr}`);
  }
}
