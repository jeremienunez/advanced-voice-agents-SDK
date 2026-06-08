import type {
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
  A2AJsonRpcMailboxAdapter,
  A2AMailboxMcpToolsOptions,
  A2AMailboxTaskRouter,
  AgentMailboxWorker,
  AgentMailboxWorkerOptions,
  AgentMailboxWorkerRunResult,
  McpJsonRpcToolAdapter,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpStreamableHttpToolHandler,
  McpToolRegistryAdapter,
} from "@voiceagentsdk/core/server";

import type {
  ActiveAgentAssignmentPort,
  ActiveAgentScope,
  A2AAgentCard,
  A2ATask,
  AgentLearningLoopPort,
  AgentLearningPolicyPort,
  AgentMailboxMessage,
  AgentMailboxPort,
  AgentSkillArtifact,
  EvaluationHarnessPort,
  EventSinkPort,
  LearningDelta,
  LearningLoopProfile,
  LearningPromotionState,
  LearningReceipt,
  LearningReceiptSinkPort,
  LearningRunRecord,
  LearningRunRepositoryPort,
  LearningRunStatus,
  LearningWorkflowDriverPort,
  MemoryStorePort,
  McpToolDescriptor,
  PendingActionPort,
  PendingActionRecord,
  ProtocolCompatibilityProfile,
  RuntimeEventRecord,
  TenantResolverPort,
} from "@voiceagentsdk/core/sdk";

type PackageModule = Record<string, unknown>;

const results = [
  await scenarioSdkCompilesThroughPublicExports(),
  await scenarioRuntimePortsArePublicTypes(),
  await scenarioLearningLoopPortsArePublicTypes(),
  await scenarioProtocolCompatibilityPortsArePublic(),
  await scenarioBrowserProtocolParserIsPublicAndStable(),
  await scenarioDeclaredPackageEntrypointsResolve(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioSdkCompilesThroughPublicExports(): Promise<string> {
  const root = await import("@voiceagentsdk/core") as PackageModule;
  const sdk = await import("@voiceagentsdk/core/sdk") as PackageModule;
  const compileFromRoot = runtimeFunction(root, "compileVoiceAgentSdk");
  const compileFromSdk = runtimeFunction(sdk, "compileVoiceAgentSdk");
  const rootCompiled = compileFromRoot(sdkDefinition()) as CompiledSdk;
  const sdkCompiled = compileFromSdk(sdkDefinition()) as CompiledSdk;

  assert(
    rootCompiled.getProvider("openai")?.id === "openai",
    "root export must compile SDK definitions",
  );
  assert(
    sdkCompiled.promptFor({ channel: "voice", variables: { name: "Ada" } }) ===
      "Hello Ada",
    "sdk export must render compiled prompts",
  );

  return "sdk-compiles-through-public-exports";
}

async function scenarioRuntimePortsArePublicTypes(): Promise<string> {
  type PublicRuntimePorts = [
    PendingActionPort,
    PendingActionRecord,
    ActiveAgentAssignmentPort,
    ActiveAgentScope,
    RuntimeEventRecord,
    EventSinkPort,
    MemoryStorePort,
    TenantResolverPort,
  ];
  const publicPortsCompile: PublicRuntimePorts | null = null;
  assert(publicPortsCompile === null, "runtime ports must be public type exports");
  return "runtime-ports-are-public-types";
}

async function scenarioLearningLoopPortsArePublicTypes(): Promise<string> {
  type PublicLearningLoopTypes = [
    AgentLearningLoopPort,
    AgentLearningPolicyPort,
    AgentSkillArtifact,
    EvaluationHarnessPort,
    LearningDelta,
    LearningLoopProfile,
    LearningPromotionState,
    LearningReceipt,
    LearningReceiptSinkPort,
    LearningRunRecord,
    LearningRunRepositoryPort,
    LearningRunStatus,
    LearningWorkflowDriverPort,
  ];
  const compileOnly: PublicLearningLoopTypes | null = null;
  assert(compileOnly === null, "learning loop ports must be public type exports");
  return "learning-loop-ports-are-public-types";
}

async function scenarioProtocolCompatibilityPortsArePublic(): Promise<string> {
  type PublicProtocolTypes = [
    A2AAgentCard,
    A2ATask,
    A2AJsonRpcRequest,
    A2AJsonRpcResponse,
    A2AJsonRpcMailboxAdapter,
    A2AMailboxMcpToolsOptions,
    A2AMailboxTaskRouter,
    AgentMailboxWorker,
    AgentMailboxWorkerOptions,
    AgentMailboxWorkerRunResult,
    AgentMailboxMessage,
    AgentMailboxPort,
    McpJsonRpcToolAdapter,
    McpJsonRpcRequest,
    McpJsonRpcResponse,
    McpStreamableHttpToolHandler,
    McpToolRegistryAdapter,
    McpToolDescriptor,
    ProtocolCompatibilityProfile,
  ];
  const compileOnly: PublicProtocolTypes | null = null;
  const sdk = await import("@voiceagentsdk/core/sdk") as PackageModule;
  const server = await import("@voiceagentsdk/core/server") as PackageModule;

  assert(typeof sdk.toMcpToolDescriptor === "function", "sdk export must expose toMcpToolDescriptor");
  assert(typeof sdk.mailboxMessageToA2ATask === "function", "sdk export must expose mailboxMessageToA2ATask");
  assert(typeof server.createAgentMailboxWorker === "function", "server export must expose createAgentMailboxWorker");
  assert(typeof server.createInMemoryAgentMailbox === "function", "server export must expose createInMemoryAgentMailbox");
  assert(typeof server.createA2AMailboxTaskRouter === "function", "server export must expose createA2AMailboxTaskRouter");
  assert(typeof server.createA2AMailboxMcpTools === "function", "server export must expose createA2AMailboxMcpTools");
  assert(typeof server.createA2AJsonRpcMailboxAdapter === "function", "server export must expose createA2AJsonRpcMailboxAdapter");
  assert(typeof server.createMcpToolRegistryAdapter === "function", "server export must expose createMcpToolRegistryAdapter");
  assert(typeof server.createMcpJsonRpcToolAdapter === "function", "server export must expose createMcpJsonRpcToolAdapter");
  assert(typeof server.createMcpStreamableHttpToolHandler === "function", "server export must expose createMcpStreamableHttpToolHandler");
  assert(compileOnly === null, "protocol compatibility and mailbox types must be public");

  return "protocol-compatibility-ports-are-public";
}

async function scenarioBrowserProtocolParserIsPublicAndStable(): Promise<string> {
  const browser = await import("@voiceagentsdk/core/server/browser") as PackageModule;
  const parse = runtimeFunction(browser, "parseBrowserVoiceClientMessage");
  const start = parse(JSON.stringify({
    type: "session.start",
    agent: "agent-a",
    provider: "openai",
    model: "gpt-realtime",
    voice: "verse",
  })) as VoiceControlMessage | null;
  const end = parse(Buffer.from(JSON.stringify({ type: "session.end" }))) as
    VoiceControlMessage | null;
  const pause = parse(JSON.stringify({ type: "audio.pause" })) as
    VoiceControlMessage | null;
  const invalid = parse(JSON.stringify({ type: "tool.call" }));

  assert(start?.type === "session.start", "public parser must keep session.start");
  assert(start.agent === "agent-a", "public parser must keep start agent");
  assert(end?.type === "session.end", "public parser must keep session.end");
  assert(pause?.type === "audio.pause", "public parser must keep audio.pause");
  assert(invalid === null, "public parser must reject server-only messages");

  return "browser-protocol-parser-is-public-and-stable";
}

async function scenarioDeclaredPackageEntrypointsResolve(): Promise<string> {
  const entrypoints: Array<[string, string]> = [
    ["@voiceagentsdk/core", "compileVoiceAgentSdk"],
    ["@voiceagentsdk/core/sdk", "createAgentBuilder"],
    ["@voiceagentsdk/core/server", "createRealtimeVoiceSession"],
    ["@voiceagentsdk/core/server/browser", "createBrowserVoiceService"],
    ["@voiceagentsdk/core/server/adapters/fastify", "createFastifyVoiceAdapter"],
    ["@voiceagentsdk/core/server/media", "createBrowserMediaHandler"],
    ["@voiceagentsdk/core/server/providers", "createOpenAIRealtimeTransport"],
    ["@voiceagentsdk/core/client/browser", "createVoiceWSClient"],
  ];

  for (const [specifier, exportName] of entrypoints) {
    const module = await import(specifier) as PackageModule;
    assert(
      typeof module[exportName] === "function",
      `${specifier} must expose ${exportName}`,
    );
  }

  return "declared-package-entrypoints-resolve";
}

interface CompiledSdk {
  getProvider(id: string): { id: string } | undefined;
  promptFor(input: {
    channel: "voice";
    variables: Record<string, string>;
  }): string;
}

interface VoiceControlMessage {
  agent?: string;
  type: string;
}

function sdkDefinition() {
  return {
    tenants: [{
      id: "local",
      displayName: "Local",
      defaultProviderId: "openai",
      defaultMediaBridgeId: "browser",
    }],
    providers: [{
      id: "openai",
      kind: "openai-realtime",
      model: "gpt-realtime",
      voice: "verse",
      apiKey: { name: "OPENAI_API_KEY" },
    }],
    mediaBridges: [{
      id: "browser",
      kind: "browser-websocket",
      providerId: "openai",
      sampleRate: 24_000,
    }],
    plans: [{ id: "dev", label: "Dev" }],
    prompts: [{
      id: "voice",
      channels: ["voice"],
      body: "Hello {{name}}",
    }],
    tools: [],
    databases: [],
    stores: [],
    onboarding: [],
    packs: [],
  };
}

function runtimeFunction(
  module: PackageModule,
  name: string,
): (...args: unknown[]) => unknown {
  const value = module[name];
  assert(typeof value === "function", `missing public function ${name}`);
  return value as (...args: unknown[]) => unknown;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
