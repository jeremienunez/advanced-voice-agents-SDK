import { compileVoiceAgentSdk } from "@voiceagentsdk/core/sdk";
import type {
  ProviderDefinition,
  ProviderFactoryInput,
  ProviderFactoryPort,
} from "@voiceagentsdk/core/sdk";
import type {
  AudioChunk,
  IRealtimeProvider,
  ProviderError,
  ProviderFunctionCall,
  RealtimeSessionUpdate,
  TransportState,
  VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import type { BrowserVoiceSessionRequest } from "@voiceagentsdk/core/server/browser";
import { createStarterProviderFactory } from "../../../server/providers/realtime-provider-factory.js";
import { createVoiceSessionFactory } from "../../../server/voice/session-factory.js";
import type { RuntimeProviderConfig } from "../../../server/providers/catalog.js";
import { assert } from "../shared/assertions.js";
import { voiceOptions } from "../fixtures/solid-seams/fixtures.js";

const results = [
  await scenarioSessionFactoryDelegatesProviderCreationToPort(),
  scenarioProviderFactoryBuildsSupportedRealtimeProviders(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioSessionFactoryDelegatesProviderCreationToPort() {
  const calls: Array<ProviderFactoryInput<VoiceSessionTool>> = [];
  const providerFactory: ProviderFactoryPort<IRealtimeProvider, VoiceSessionTool> = {
    createProvider(input) {
      calls.push(input);
      return new FakeRealtimeProvider();
    },
  };
  const factory = createVoiceSessionFactory(
    voiceOptions({
      providerCatalog: [runtimeProvider()],
      providerFactory,
      promptCompiler: { compilePrompt: () => "compiled prompt" },
      sdk: sdk(),
    }),
  );

  const session = await factory(request(), {});
  const input = calls.at(0);

  assert(calls.length === 1, "session factory must call provider factory once");
  assert(input !== undefined, "provider factory input must be captured");
  assert(input.definition.id === "gemini", "provider definition must be passed");
  assert(input.requestedModel === "gemini-test", "requested model must be passed");
  assert(input.requestedVoice === "Puck", "requested voice must be passed");
  assert(
    input.instructions.includes("compiled prompt"),
    "compiled instructions must be passed",
  );
  assert(
    input.tools.length === 1 && input.tools[0]?.name === "set_affect",
    "runtime tools must be passed (affect side-channel always exposed)",
  );
  assert(session.config.providerId === "gemini", "session config stays provider scoped");

  return "session-factory-delegates-provider-creation";
}

function scenarioProviderFactoryBuildsSupportedRealtimeProviders() {
  const factory = createStarterProviderFactory({
    providerCatalog: [
      runtimeProvider("openai", "openai-realtime"),
      runtimeProvider("gemini", "gemini-live"),
      runtimeProvider("grok", "grok-realtime"),
      runtimeProvider("cascaded", "cascaded"),
    ],
    secretResolver: { resolveSecret: () => "test-secret" },
  });
  const observed = [
    providerId(factory, "openai", "openai-realtime"),
    providerId(factory, "gemini", "gemini-live"),
    providerId(factory, "grok", "grok-realtime"),
    providerId(factory, "cascaded", "cascaded"),
  ];

  assert(
    observed.join(",") ===
      "openai-realtime,gemini-realtime,grok-realtime,cascaded",
    `provider factory must build every supported runtime adapter, got ${observed}`,
  );

  return "provider-factory-builds-supported-realtime-providers";
}

function providerId(
  factory: ProviderFactoryPort<IRealtimeProvider, VoiceSessionTool>,
  id: string,
  kind: RuntimeProviderConfig["kind"],
): string {
  const provider = factory.createProvider({
    definition: providerDefinition(id, kind),
    instructions: "test instructions",
    tools: [],
  });

  return provider.providerId;
}

function request(): BrowserVoiceSessionRequest {
  return {
    sessionId: "session-provider-factory",
    provider: "gemini",
    model: "gemini-test",
    voice: "Puck",
    user: { tenantId: "local", userId: "demo" },
  };
}

function runtimeProvider(
  id: RuntimeProviderConfig["id"] = "gemini",
  kind: RuntimeProviderConfig["kind"] = "gemini-live",
): RuntimeProviderConfig {
  return {
    id,
    label: id,
    kind,
    requiredEnv: [`${id.toUpperCase()}_API_KEY`],
    enabled: true,
    models: [`${id}-test`],
    voices: ["Puck"],
    defaultModel: `${id}-test`,
    defaultVoice: "Puck",
    inputSampleRate: 16_000,
    outputSampleRate: 24_000,
  };
}

function providerDefinition(
  id: string,
  kind: RuntimeProviderConfig["kind"],
): ProviderDefinition {
  return {
    id,
    kind,
    model: `${id}-test`,
    voice: "Puck",
    apiKey: { name: `${id.toUpperCase()}_API_KEY` },
  };
}

function sdk() {
  return compileVoiceAgentSdk({
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
    plans: [],
    prompts: [{
      id: "voice",
      channels: ["voice"],
      body: "Provider {{providerId}}",
    }],
    tools: [],
    databases: [],
    stores: [],
    onboarding: [],
    packs: [],
  });
}

class FakeRealtimeProvider implements IRealtimeProvider {
  readonly providerId = "fake-provider-factory";
  state: TransportState = "disconnected";
  lastSpeechEndMs: number | null = null;
  currentResponseItemId: string | null = null;
  get isConnected(): boolean { return this.state === "connected"; }
  async connect(): Promise<void> { this.state = "connected"; }
  async disconnect(): Promise<void> { this.state = "disconnected"; }
  async dispose(): Promise<void> { await this.disconnect(); }
  async sendAudio(_chunk: AudioChunk): Promise<void> {}
  onAudio(_handler: (chunk: AudioChunk) => void): void {}
  async updateSession(_config: RealtimeSessionUpdate): Promise<void> {}
  async createResponse(_options?: Record<string, unknown>): Promise<void> {}
  async cancelResponse(): Promise<void> {}
  async truncateResponse(
    _itemId: string,
    _contentIndex: number,
    _audioEndMs: number,
  ): Promise<void> {}
  async submitFunctionResult(
    _callId: string,
    _result: unknown,
    _triggerResponse?: boolean,
  ): Promise<void> {}
  onFunctionCall(_handler: (call: ProviderFunctionCall) => void): void {}
  onSpeechStarted(_handler: () => void): void {}
  onSpeechStopped(_handler: (audioEndMs?: number) => void): void {}
  onResponseStarted(_handler: (responseId: string) => void): void {}
  onResponseCompleted(_handler: (responseId: string) => void): void {}
  onTranscript(_handler: (text: string, isFinal: boolean) => void): void {}
  onError(_handler: (error: ProviderError) => void): void {}
}
