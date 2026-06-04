import type { AuthTicketInput } from "@voiceagentsdk/core/sdk";
import {
  createA2AMailboxTaskRouter,
  createInMemoryAgentMailbox,
} from "@voiceagentsdk/core/server";
import type {
  BrowserVoiceSessionRequest,
} from "@voiceagentsdk/core/server/browser";
import { createStarterServerApp } from "../server/app/bootstrap.js";
import { loadStarterServerEnv } from "../server/app/env.js";
import { createDevAuthTicketVerifier } from "../server/auth/dev-ticket-verifier.js";
import { accessGuard } from "../server/http/guards.js";
import { createRuntimeMemoryStoreFromEnv } from "../server/runtime/memory-store.js";
import { createVoiceSessionFactory } from "../server/voice/session-factory.js";
import { assert } from "./shared/assertions.js";
import { agentDraft, builderService, voiceOptions } from "./solid-seams/fixtures.js";

const results = [
  scenarioInvalidStarterModeFailsClosed(),
  scenarioProductionModeRejectsDevTokenVerifier(),
  scenarioProductionModeRejectsLocalFileStateBootstrap(),
  scenarioProductionModeAcceptsInjectedAdapters(),
  await scenarioProductionModeRejectsQueryIdentityAndToken(),
  await scenarioProductionModeRequiresExplicitAgent(),
  scenarioProductionModeRejectsLocalRuntimeMemory(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioInvalidStarterModeFailsClosed() {
  const restore = withEnv({
    VOICE_STARTER_MODE: "prod",
  });
  try {
    const error = captureSyncError(() => loadStarterServerEnv());
    assert(
      error?.message.includes("VOICE_STARTER_MODE"),
      `invalid starter mode must fail closed, got ${error?.message ?? "success"}`,
    );
  } finally {
    restore();
  }

  return "invalid-starter-mode-fails-closed";
}

function scenarioProductionModeRejectsDevTokenVerifier() {
  const restore = withEnv({
    NODE_ENV: "development",
    VOICE_DEV_AUTH_TOKEN: "dev-secret",
    VOICE_STARTER_MODE: "production",
  });
  try {
    const env = loadStarterServerEnv();
    const error = captureSyncError(() => createDevAuthTicketVerifier(env));
    assert(
      error?.message.includes("DevAuthTicketVerifier") &&
        error.message.includes("production"),
      `production mode must reject dev-token verifier, got ${error?.message ?? "success"}`,
    );
  } finally {
    restore();
  }

  return "production-mode-rejects-dev-token-verifier";
}

function scenarioProductionModeRejectsLocalFileStateBootstrap() {
  const restore = withEnv({
    VOICE_STARTER_MODE: "production",
  });
  try {
    const error = captureSyncError(() => createStarterServerApp());
    assert(
      error?.message.includes("local file state") &&
        error.message.includes("production"),
      `production mode must reject starter local file state, got ${error?.message ?? "success"}`,
    );
  } finally {
    restore();
  }

  return "production-mode-rejects-local-file-state-bootstrap";
}

function scenarioProductionModeAcceptsInjectedAdapters() {
  const restore = withEnv({
    VOICE_STARTER_MODE: "production",
  });
  const authTicketVerifier = {
    verifyTicket: () => ({ tenantId: "tenant-prod", userId: "user-prod" }),
  };
  try {
    const app = createStarterServerApp({
      authTicketVerifier,
      builderService: builderService(agentDraft("draft-prod-injected")),
      learningService: {
        approveInfraEvolution: async () => ({
          status: "skipped" as const,
          draftId: "draft-prod-injected",
          version: 0,
          reason: "test",
        }),
        enqueueSessionLearning: () => ({
          jobId: "job-prod",
          runId: "run-prod",
          status: "skipped",
          queuedAt: new Date(0).toISOString(),
        }),
        getLearningStatus: () => null,
        rollback: async () => ({
          status: "skipped" as const,
          draftId: "draft-prod-injected",
          version: 0,
          reason: "test",
        }),
      },
      runtimeMemoryStore: {
        write: (input) => ({
          id: "memory-prod",
          kind: input.kind,
          scope: input.scope,
          value: input.value,
          createdAt: new Date(0).toISOString(),
        }),
        list: () => [],
      },
      a2aMailboxRouter: createProductionA2ARouter(),
      tenantResolver: {
        resolveTenant: () => ({
          tenantId: "tenant-prod",
          providerId: "gemini",
          mediaBridgeId: "browser",
          planId: "prod",
          userId: "user-prod",
        }),
      },
    });
    assert(
      app.authTicketVerifier === authTicketVerifier,
      "production bootstrap must use injected auth verifier",
    );
  } finally {
    restore();
  }

  return "production-mode-accepts-injected-adapters";
}

async function scenarioProductionModeRejectsQueryIdentityAndToken() {
  const env = {
    allowedOrigins: new Set<string>(),
    browserSampleRate: 24_000,
    hostname: "127.0.0.1",
    isProduction: false,
    mode: "production",
    port: 8787,
    publicHost: "127.0.0.1",
  } as const;
  const verifier = {
    verifyTicket(_input: AuthTicketInput) {
      return { tenantId: "tenant-a", userId: "user-a" };
    },
  };
  const request = new Request(
    "http://127.0.0.1:8787/voice/ws?tenantId=local&userId=demo&token=dev-secret",
  );
  const result = await accessGuard(env, verifier, request, new URL(request.url));

  assert(result.response?.status === 400, "production query fallback must fail closed");
  assert(
    (await result.response.text()).includes("local-only"),
    "production query fallback error must be explicit",
  );

  return "production-mode-rejects-query-identity-and-token";
}

async function scenarioProductionModeRequiresExplicitAgent() {
  const baseOptions = voiceOptions();
  const factory = createVoiceSessionFactory(
    voiceOptions({
      starterMode: "production",
      providerCatalog: [{
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
      }],
      sdk: {
        ...baseOptions.sdk,
        getProvider: () => ({
          id: "gemini",
          kind: "gemini-live",
          model: "gemini-test",
          voice: "Puck",
          apiKey: { name: "GEMINI_API_KEY" },
        }),
        getMediaBridge: () => ({ id: "browser", kind: "browser-websocket" }),
      },
    }),
  );
  const error = await captureAsyncError(() => factory(requestWithoutAgent(), {}));

  assert(
    error?.message.includes("agent") && error.message.includes("production"),
    `production mode must require explicit agent, got ${error?.message ?? "success"}`,
  );

  return "production-mode-requires-explicit-agent";
}

function scenarioProductionModeRejectsLocalRuntimeMemory() {
  const error = captureSyncError(() =>
    createRuntimeMemoryStoreFromEnv({
      VOICE_STARTER_MODE: "production",
      AGENT_RUNTIME_MEMORY_DRIVER: "local",
    })
  );

  assert(
    error?.message.includes("local runtime memory") &&
      error.message.includes("production"),
    `production mode must reject local runtime memory, got ${error?.message ?? "success"}`,
  );

  return "production-mode-rejects-local-runtime-memory";
}

function requestWithoutAgent(): BrowserVoiceSessionRequest {
  return {
    sessionId: "session-production-mode",
    provider: "gemini",
    user: { tenantId: "tenant-a", userId: "user-a" },
  };
}

function createProductionA2ARouter() {
  return createA2AMailboxTaskRouter({
    mailbox: createInMemoryAgentMailbox({
      idFactory: () => "mail-prod",
      now: () => new Date(0),
    }),
  });
}

function withEnv(values: Record<string, string | undefined>): () => void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Bun.env[key]);
    if (value === undefined) delete Bun.env[key];
    else Bun.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete Bun.env[key];
      else Bun.env[key] = value;
    }
  };
}

function captureSyncError(action: () => unknown): Error | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

async function captureAsyncError(action: () => Promise<unknown>): Promise<Error | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
