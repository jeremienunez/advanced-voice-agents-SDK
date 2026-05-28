import {
  compileVoiceAgentSdk,
  type CompiledAgentArtifact,
  type PromptCompilerPort,
  type RuntimePromptCompileInput,
  type TenantResolutionResult,
  type ToolManifest,
  type VoiceAgentSdkDefinition,
} from "@voiceagentsdk/core/sdk";
import type {
  ProviderFactoryInput,
  ProviderFactoryPort,
} from "@voiceagentsdk/core/sdk";
import type {
  IRealtimeProvider,
  VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import type { BrowserVoiceSessionRequest } from "@voiceagentsdk/core/server/browser";
import { createStarterPromptCompiler } from "../server/runtime/prompt-compiler.js";
import type { RuntimeProviderConfig } from "../server/providers/catalog.js";
import { E2EFakeRealtimeProvider } from "../server/providers/e2e-fake-provider.js";
import { createVoiceSessionFactory } from "../server/voice/session-factory.js";
import { assert } from "./shared/assertions.js";
import { agentDraft, builderService, voiceOptions } from "./solid-seams/fixtures.js";

const results = [
  await scenarioSessionFactoryUsesPromptCompilerPort(),
  await scenarioStarterCompilerOwnsCompiledAndFallbackPrompts(),
  await scenarioRuntimeKnowledgePolicyBelongsToCompiler(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioSessionFactoryUsesPromptCompilerPort(): Promise<string> {
  const compilerCalls: RuntimePromptCompileInput[] = [];
  const providerCalls: Array<ProviderFactoryInput<VoiceSessionTool>> = [];
  const factory = createVoiceSessionFactory(
    voiceOptions({
      builderService: builderService(draftWithTool()),
      providerCatalog: [runtimeProvider()],
      providerFactory: recordingProviderFactory(providerCalls),
      promptCompiler: recordingPromptCompiler(compilerCalls),
      sdk: sdk(),
    }),
  );

  await factory(request(), {});
  const input = compilerCalls.at(0);

  assert(input?.channel === "voice", "compiler input must bind voice channel");
  assert(input.providerId === "gemini", "compiler input must include provider");
  assert(input.agentId === "draft_prompt_compiler_bdd", "compiler input must include agent id");
  assert(input.tenant.planId === "dev", "compiler input must include tenant plan");
  assert(
    input.toolNames.includes("create_summary"),
    "compiler input must include executable runtime tool names",
  );
  assert(
    providerCalls.at(0)?.instructions ===
      "PORT voice gemini dev create_summary",
    "provider instructions must come from the compiler port",
  );

  return "session-factory-uses-prompt-compiler-port";
}

async function scenarioStarterCompilerOwnsCompiledAndFallbackPrompts(): Promise<string> {
  const compiled = createStarterPromptCompiler({
    builderService: compiledBuilder(artifact({ prompt: "Compiled prompt body" })),
    sdk: sdk(),
  });
  const fallback = createStarterPromptCompiler({
    builderService: compiledBuilder(undefined),
    sdk: sdk(),
  });
  const compiledPrompt = await compiled.compilePrompt(input());
  const fallbackPrompt = await fallback.compilePrompt(input({
    promptVariables: { segment: "vip" },
  }));

  assert(
    compiledPrompt === "Compiled prompt body",
    "compiled artifact prompts must stay behind the compiler adapter",
  );
  assert(
    fallbackPrompt.includes(
      "Tenant tenant-a Provider gemini Plan pro User user-a Segment vip",
    ),
    `fallback SDK prompt must stay behind compiler adapter, got: ${fallbackPrompt}`,
  );

  return "starter-compiler-owns-compiled-and-fallback-prompts";
}

async function scenarioRuntimeKnowledgePolicyBelongsToCompiler(): Promise<string> {
  const compiler = createStarterPromptCompiler({
    builderService: compiledBuilder(artifact({
      prompt: "Knowledge prompt without runtime tool instructions",
      selectedTools: ["search_knowledge"],
      knowledge: {
        strategy: "hybrid_kg",
        documentCount: 2,
        chunkCount: 8,
        status: "compiled",
      },
    })),
    sdk: sdk(),
  });
  const prompt = await compiler.compilePrompt(input());

  assert(
    prompt.includes("Runtime knowledge tool:"),
    "runtime knowledge policy must be appended by the prompt compiler",
  );
  assert(
    prompt.includes("Use search_knowledge before factual answers"),
    "knowledge retrieval instructions must be compiler-owned",
  );

  return "runtime-knowledge-policy-belongs-to-compiler";
}

function recordingPromptCompiler(
  calls: RuntimePromptCompileInput[],
): PromptCompilerPort {
  return {
    compilePrompt(input: RuntimePromptCompileInput): string {
      calls.push(input);
      return `PORT ${input.channel} ${input.providerId} ${input.tenant.planId} ${
        input.toolNames.join(",")
      }`;
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

function compiledBuilder(compiled: CompiledAgentArtifact | undefined) {
  return {
    getCompiledArtifact: () => compiled,
  };
}

function input(
  overrides: Partial<TenantResolutionResult> = {},
): RuntimePromptCompileInput {
  return {
    channel: "voice",
    providerId: "gemini",
    agentId: "draft_prompt_compiler_bdd",
    tenant: tenant(overrides),
    toolNames: [],
  };
}

function tenant(
  overrides: Partial<TenantResolutionResult> = {},
): TenantResolutionResult {
  return {
    tenantId: "tenant-a",
    providerId: "gemini",
    mediaBridgeId: "browser",
    planId: "pro",
    userId: "user-a",
    ...overrides,
  };
}

function request(): BrowserVoiceSessionRequest {
  return {
    sessionId: "session-prompt-compiler",
    provider: "gemini",
    agent: "draft_prompt_compiler_bdd",
    user: { tenantId: "tenant-a", userId: "user-a", planId: "dev" },
  };
}

function draftWithTool() {
  const draft = agentDraft("draft_prompt_compiler_bdd");
  return {
    ...draft,
    selectedTools: ["create_summary"],
    compiled: artifact({ selectedTools: ["create_summary"] }),
  };
}

function artifact(
  overrides: Partial<CompiledAgentArtifact> = {},
): CompiledAgentArtifact {
  return {
    draftId: "draft_prompt_compiler_bdd",
    sdkDefinition: sdkDefinition([summaryTool()]),
    prompt: "Compiled prompt body",
    toolRegistry: [],
    selectedTools: ["create_summary"],
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function summaryTool(): ToolManifest {
  return {
    name: "create_summary",
    description: "Create a summary",
    category: "test",
    parameters: { type: "object", properties: {} },
    handlerRef: "summary.create",
  };
}

function sdk() {
  return compileVoiceAgentSdk(sdkDefinition());
}

function sdkDefinition(tools: ToolManifest[] = []): VoiceAgentSdkDefinition {
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
    plans: [{ id: "pro", label: "Pro" }],
    prompts: [{
      id: "voice",
      channels: ["voice"],
      body:
        "Tenant {{tenantId}} Provider {{providerId}} Plan {{planId}} " +
        "User {{userId}} Segment {{segment}}",
    }],
    tools,
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
