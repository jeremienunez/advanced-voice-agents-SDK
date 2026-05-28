import {
  compileVoiceAgentSdk,
  type MemoryRecord,
  type MemoryStorePort,
  type MemoryStoreWriteInput,
  type ProviderFactoryInput,
  type ProviderFactoryPort,
  type RuntimePromptCompileInput,
  type TenantResolutionResult,
  type VoiceAgentSdkDefinition,
} from "@voiceagentsdk/core/sdk";
import {
  createInMemoryMemoryStore,
  type IRealtimeProvider,
  type VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import type { BrowserVoiceSessionRequest } from "@voiceagentsdk/core/server/browser";
import { createRuntimeMemoryStoreFromEnv } from "../server/runtime/memory-store.js";
import { E2EFakeRealtimeProvider } from "../server/providers/e2e-fake-provider.js";
import type { RuntimeProviderConfig } from "../server/providers/catalog.js";
import { createVoiceSessionFactory } from "../server/voice/session-factory.js";
import { assert, assertThrows } from "./shared/assertions.js";
import { agentDraft, builderService, voiceOptions } from "./solid-seams/fixtures.js";

const results = [
  await scenarioInMemoryStoreScopesAndExpiresRecords(),
  await scenarioSessionFactoryUsesMemoryStorePort(),
  await scenarioRuntimeMemoryFactoryIsEnvSelected(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioInMemoryStoreScopesAndExpiresRecords(): Promise<string> {
  let now = new Date("2026-05-28T10:00:00.000Z");
  let id = 0;
  const store = createInMemoryMemoryStore({
    idFactory: () => `mem-${++id}`,
    now: () => now,
  });
  await store.write({
    scope: scope({ sessionId: "session-a" }),
    kind: "preference",
    value: { text: "Answer in short French sentences." },
    ttlSeconds: 1,
  });
  await store.write({
    scope: scope({ userId: "user-b", sessionId: "session-b" }),
    kind: "preference",
    value: { text: "Do not leak across users." },
  });

  const scoped = await store.list({
    scope: scope({ sessionId: "session-a" }),
    kind: "preference",
  });
  assert(scoped.length === 1, "in-memory memory must isolate tenant/user/session scope");
  assert(
    scoped[0]?.value && typeof scoped[0].value === "object",
    "memory value must round-trip through the port",
  );

  now = new Date("2026-05-28T10:00:02.000Z");
  const expired = await store.list({ scope: scope({ sessionId: "session-a" }) });
  assert(expired.length === 0, "in-memory memory must honor TTL deterministically");

  return "in-memory-store-scopes-and-expires-records";
}

async function scenarioSessionFactoryUsesMemoryStorePort(): Promise<string> {
  const listCalls: Array<{ scope: MemoryRecord["scope"]; kind?: string }> = [];
  const writes: MemoryStoreWriteInput[] = [];
  const compilerCalls: RuntimePromptCompileInput[] = [];
  const providerCalls: Array<ProviderFactoryInput<VoiceSessionTool>> = [];
  const memoryStore = recordingMemoryStore(
    [existingPreferenceMemory()],
    listCalls,
    writes,
  );
  const factory = createVoiceSessionFactory(
    voiceOptions({
      builderService: builderService(agentDraft("draft_memory_store_bdd")),
      memoryStore,
      providerCatalog: [runtimeProvider()],
      providerFactory: recordingProviderFactory(providerCalls),
      promptCompiler: {
        compilePrompt(input) {
          compilerCalls.push(input);
          return `memory-count:${input.memories?.length ?? 0}`;
        },
      },
      sdk: sdk(),
      tenantResolver: { resolveTenant: () => tenant() },
    }),
  );

  await factory(request(), {});

  assert(
    listCalls.at(0)?.scope.tenantId === "tenant-a" &&
      listCalls.at(0)?.scope.userId === "user-a",
    "voice runtime must read memories through MemoryStorePort before prompt compilation",
  );
  assert(
    compilerCalls.at(0)?.memories?.at(0)?.id === "memory-existing",
    "prompt compiler input must receive scoped memory records from the port",
  );
  assert(
    writes.some((write) =>
      write.kind === "session.started" &&
      write.scope.sessionId === "session-memory-store"
    ),
    "voice runtime must write session memory through MemoryStorePort",
  );
  assert(
    providerCalls.at(0)?.instructions === "memory-count:1",
    "provider instructions must reflect memory supplied through the compiler input",
  );

  return "session-factory-uses-memory-store-port";
}

async function scenarioRuntimeMemoryFactoryIsEnvSelected(): Promise<string> {
  let redisOptions: unknown;
  const redisStore = recordingMemoryStore([], [], []);
  const local = createRuntimeMemoryStoreFromEnv({});
  const redis = createRuntimeMemoryStoreFromEnv({
    AGENT_RUNTIME_MEMORY_DRIVER: "redis",
    AGENT_RUNTIME_MEMORY_NAMESPACE: "bdd-runtime",
    AGENT_RUNTIME_MEMORY_TTL_SECONDS: "42",
    REDIS_URL: "redis://127.0.0.1:6379",
  }, {
    redisFactory(options) {
      redisOptions = options;
      return redisStore;
    },
  });

  await local.write({
    scope: scope({ sessionId: "local-session" }),
    kind: "session.started",
    value: { ok: true },
  });

  assert(redis === redisStore, "redis env selection must return the injected Redis adapter");
  assert(
    JSON.stringify(redisOptions).includes("bdd-runtime") &&
      JSON.stringify(redisOptions).includes("42"),
    "redis env selection must pass namespace and TTL options to the adapter",
  );
  assertThrows(
    () => createRuntimeMemoryStoreFromEnv({ AGENT_RUNTIME_MEMORY_DRIVER: "redis" }),
    "REDIS_URL is required for redis runtime memory driver",
  );

  return "runtime-memory-factory-is-env-selected";
}

function recordingMemoryStore(
  records: MemoryRecord[],
  listCalls: Array<{ scope: MemoryRecord["scope"]; kind?: string }>,
  writes: MemoryStoreWriteInput[],
): MemoryStorePort {
  return {
    write(input) {
      writes.push(input);
      return {
        id: input.id ?? `write-${writes.length}`,
        scope: { ...input.scope },
        kind: input.kind,
        value: input.value,
        createdAt: new Date(0).toISOString(),
      };
    },
    list(input) {
      listCalls.push(input);
      return records.filter((record) =>
        record.scope.tenantId === input.scope.tenantId &&
        record.scope.userId === input.scope.userId &&
        (!input.kind || record.kind === input.kind)
      );
    },
  };
}

function recordingProviderFactory(
  calls: Array<ProviderFactoryInput<VoiceSessionTool>>,
): ProviderFactoryPort<IRealtimeProvider, VoiceSessionTool> {
  return {
    createProvider(input) {
      calls.push(input);
      return new E2EFakeRealtimeProvider();
    },
  };
}

function existingPreferenceMemory(): MemoryRecord {
  return {
    id: "memory-existing",
    scope: scope(),
    kind: "preference",
    value: { text: "Keep answers concise." },
    createdAt: new Date(0).toISOString(),
  };
}

function request(): BrowserVoiceSessionRequest {
  return {
    sessionId: "session-memory-store",
    provider: "gemini",
    agent: "draft_memory_store_bdd",
    user: { tenantId: "tenant-a", userId: "user-a", planId: "dev" },
  };
}

function tenant(): TenantResolutionResult {
  return {
    tenantId: "tenant-a",
    providerId: "gemini",
    mediaBridgeId: "browser",
    planId: "dev",
    userId: "user-a",
  };
}

function scope(
  overrides: Partial<MemoryRecord["scope"]> = {},
): MemoryRecord["scope"] {
  return {
    tenantId: "tenant-a",
    userId: "user-a",
    agentId: "draft_memory_store_bdd",
    ...overrides,
  };
}

function sdk() {
  return compileVoiceAgentSdk(sdkDefinition());
}

function sdkDefinition(): VoiceAgentSdkDefinition {
  return {
    tenants: [{
      id: "local",
      displayName: "Local",
      defaultProviderId: "gemini",
      defaultMediaBridgeId: "browser",
    }],
    providers: [{
      id: "gemini",
      kind: "gemini-live",
      model: "gemini-test",
      voice: "Puck",
      apiKey: { name: "GEMINI_API_KEY" },
    }],
    mediaBridges: [{
      id: "browser",
      kind: "browser-websocket",
      providerId: "gemini",
      sampleRate: 24_000,
    }],
    plans: [{ id: "dev", label: "Dev" }],
    prompts: [],
    tools: [],
    databases: [],
    stores: [],
    onboarding: [],
    packs: [],
  };
}

function runtimeProvider(): RuntimeProviderConfig {
  return {
    id: "gemini",
    label: "Gemini",
    kind: "gemini-live",
    requiredEnv: ["GEMINI_API_KEY"],
    enabled: true,
    models: ["gemini-test"],
    voices: ["Puck"],
    defaultModel: "gemini-test",
    defaultVoice: "Puck",
    inputSampleRate: 16_000,
    outputSampleRate: 24_000,
  };
}
