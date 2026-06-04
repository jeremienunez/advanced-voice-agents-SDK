import type {
  ActiveAgentAssignmentPort,
  AuthTicketPort,
  MemoryStorePort,
  PendingActionPort,
  PromptCompilerPort,
  ProviderFactoryPort,
  SecretResolverPort,
  TenantResolverPort,
} from "@voiceagentsdk/core/sdk";
import {
  createA2AMailboxTaskRouter,
  createInMemoryAgentMailbox,
  createInMemoryPendingActionPort,
  ToolExecutionPolicyEngine,
  type IRealtimeProvider,
  type VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import { createBuilderServiceFromEnv } from "../builder/index.js";
import { createDevAuthTicketVerifier } from "../auth/dev-ticket-verifier.js";
import { createGlobalActiveAgentAssignment } from "../builder/state/active-agent-assignment.js";
import { createStarterLearningServiceFromEnv } from "../learning/service.js";
import {
  createProviderCatalog,
  resolveDefaultProviderId,
  type RuntimeProviderConfig,
} from "../providers/catalog.js";
import { createStarterProviderFactory } from "../providers/realtime-provider-factory.js";
import { createEnvSecretResolver } from "../secrets/index.js";
import { createStarterVoiceService } from "../voice/service.js";
import { createDevTenantResolver } from "../voice/dev-tenant-resolver.js";
import { corsHeadersFor } from "../http/cors.js";
import { loadStarterServerEnv } from "./env.js";
import { createRuntimeKnowledgeFromEnv } from "./runtime-knowledge.js";
import { createStarterSdk } from "./starter-sdk.js";
import { assertLocalFileStateAllowed } from "./starter-mode.js";
import { createStarterPromptCompiler } from "../runtime/prompt-compiler.js";
import { createRuntimeMemoryStoreFromEnv } from "../runtime/memory-store.js";
import { createRuntimePendingActionApprovalService } from "../voice/pending-action-approval.js";
import { toolsForRequest } from "../voice/toolset.js";
import { createStarterMcpToolService } from "../mcp/tool-service.js";
import type {
  BuilderService,
  RuntimeKnowledge,
  StarterSdk,
} from "../voice/types.js";
import type { StarterLearningService } from "../learning/service.js";
import type { StarterServerEnv } from "../http/types.js";

export interface StarterServerAppOptions {
  activeAgentAssignment?: ActiveAgentAssignmentPort;
  authTicketVerifier?: AuthTicketPort;
  builderService?: BuilderService;
  learningService?: StarterLearningService;
  pendingActions?: PendingActionPort;
  promptCompiler?: PromptCompilerPort;
  providerCatalog?: RuntimeProviderConfig[];
  providerFactory?: ProviderFactoryPort<IRealtimeProvider, VoiceSessionTool>;
  a2aMailboxRouter?: ReturnType<typeof createA2AMailboxTaskRouter>;
  runtimeKnowledge?: RuntimeKnowledge;
  runtimeMemoryStore?: MemoryStorePort;
  sdk?: StarterSdk;
  secretResolver?: SecretResolverPort;
  tenantResolver?: TenantResolverPort;
  toolPolicyEngine?: ToolExecutionPolicyEngine;
}

export function createStarterServerApp(options: StarterServerAppOptions = {}) {
  const env = loadStarterServerEnv();
  assertStarterServerDependencies(env, options);
  const providerCatalog = options.providerCatalog ?? createProviderCatalog();
  const defaultProviderId = resolveDefaultProviderId(providerCatalog);
  const sdk = options.sdk ?? createStarterSdk(
    providerCatalog,
    defaultProviderId,
    env.browserSampleRate,
  );
  const activeAgentAssignment = options.activeAgentAssignment ??
    createGlobalActiveAgentAssignment();
  const secretResolver = options.secretResolver ?? createEnvSecretResolver();
  const builderService = options.builderService ?? createBuilderServiceFromEnv({
    port: env.port,
    corsHeaders: (request) => corsHeadersFor(env, request),
    activeAgentAssignment,
  });
  const learningService = options.learningService ??
    createStarterLearningServiceFromEnv(Bun.env, { activeAgentAssignment });
  const runtimeKnowledge = options.runtimeKnowledge ??
    createRuntimeKnowledgeFromEnv({ secretResolver });
  const pendingActions = options.pendingActions ?? createInMemoryPendingActionPort();
  const toolPolicyEngine = options.toolPolicyEngine ??
    new ToolExecutionPolicyEngine({ pendingActions });
  const voiceService = createStarterVoiceService({
    activeAgentAssignment,
    builderService,
    browserSampleRate: env.browserSampleRate,
    learning: learningService,
    memoryStore: options.runtimeMemoryStore ?? createRuntimeMemoryStoreFromEnv(),
    providerCatalog,
    providerFactory: options.providerFactory ?? createStarterProviderFactory({
      providerCatalog,
      secretResolver,
    }),
    promptCompiler: options.promptCompiler ??
      createStarterPromptCompiler({ builderService, sdk }),
    runtimeKnowledge,
    secretResolver,
    starterMode: env.mode,
    tenantResolver: options.tenantResolver ?? createDevTenantResolver(sdk),
    toolPolicyEngine,
    sdk,
  });
  const runtimePendingActions = createRuntimePendingActionApprovalService({
    pendingActions,
    toolPolicyEngine,
    resolveTools: (pending) =>
      toolsForRequest(pendingMetadataString(pending.metadata, "agentId"), {
        builderService,
        runtimeKnowledge,
      }),
  });
  const a2aMailboxRouter = options.a2aMailboxRouter ??
    createA2AMailboxTaskRouter({ mailbox: createInMemoryAgentMailbox() });
  const mcpToolService = createStarterMcpToolService({
    a2aMailboxRouter,
    builderService,
    runtimeKnowledge,
    toolPolicyEngine,
  });

  return {
    a2aMailboxRouter,
    authTicketVerifier: options.authTicketVerifier ?? createDevAuthTicketVerifier(env),
    builderService,
    defaultProviderId,
    env,
    learningService,
    mcpToolService,
    providerCatalog,
    runtimePendingActions,
    sdk,
    voiceService,
  };
}

export type StarterServerApp = ReturnType<typeof createStarterServerApp>;

function assertStarterServerDependencies(
  env: StarterServerEnv,
  options: StarterServerAppOptions,
): void {
  if (options.toolPolicyEngine && !options.pendingActions) {
    throw new Error(
      "pendingActions must be provided with a custom toolPolicyEngine",
    );
  }
  if (env.mode !== "production") {
    assertLocalFileStateAllowed(env.mode);
    return;
  }
  const missing = [
    ["authTicketVerifier", options.authTicketVerifier],
    ["builderService", options.builderService],
    ["learningService", options.learningService],
    ["a2aMailboxRouter", options.a2aMailboxRouter],
    ["runtimeMemoryStore", options.runtimeMemoryStore],
    ["tenantResolver", options.tenantResolver],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length === 0) return;
  throw new Error(
    `local file state and dev-only fallbacks are refused in production starter mode; ` +
      `pass app-owned adapters: ${missing.join(", ")}`,
  );
}

function pendingMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}
