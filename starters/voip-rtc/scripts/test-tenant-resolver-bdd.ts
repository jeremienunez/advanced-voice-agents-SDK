import {
  compileVoiceAgentSdk,
  type TenantResolutionInput,
  type TenantResolutionResult,
} from "@voiceagentsdk/core/sdk";
import type {
  BrowserVoiceSessionRequest,
} from "@voiceagentsdk/core/server/browser";
import type { VoiceSessionConfig } from "@voiceagentsdk/core/server";
import { createVoiceMediaConfig } from "../server/voice/media-config.js";
import { createVoiceSessionFactory } from "../server/voice/session-factory.js";
import { createStarterPromptCompiler } from "../server/runtime/prompt-compiler.js";
import type { RuntimeProviderConfig } from "../server/providers/catalog.js";
import type { StarterVoiceServiceOptions } from "../server/voice/types.js";
import { assert } from "./shared/assertions.js";
import { voiceOptions } from "./solid-seams/fixtures.js";

const results = [
  scenarioMediaSampleRateUsesTenantResolverProvider(),
  await scenarioFallbackPromptUsesResolverVariables(),
  await scenarioSessionFactoryUsesTenantResolverScope(),
  await scenarioSessionFactoryRejectsUnknownMediaBridge(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioMediaSampleRateUsesTenantResolverProvider(): string {
  const media = createVoiceMediaConfig(optionsWithResolver());
  assert(media, "voice media config must be created");
  const resolver = media.llmInputSampleRate;
  const rate = typeof resolver === "function"
    ? resolver(request())
    : resolver;

  assert(
    rate === 24_000,
    "media sample rate must follow resolver provider, not request provider",
  );

  return "media-sample-rate-uses-tenant-resolver-provider";
}

async function scenarioFallbackPromptUsesResolverVariables(): Promise<string> {
  const options = optionsWithoutCompiledPrompt({
    promptVariables: {
      segment: "vip",
      tenantId: "spoofed-tenant",
    },
  });
  const tenant = options.tenantResolver.resolveTenant({ channel: "voice" });
  const compiler = createStarterPromptCompiler({
    builderService: options.builderService,
    sdk: options.sdk,
  });
  const prompt = await compiler.compilePrompt({
    channel: "voice",
    providerId: "openai",
    tenant,
    toolNames: [],
  });

  assert(
    prompt.includes(
      "Tenant tenant-resolved Provider openai Plan pro User user-resolved Segment vip",
    ),
    `fallback prompt must keep runtime scope authoritative, got: ${prompt}`,
  );

  return "fallback-prompt-uses-resolver-variables";
}

async function scenarioSessionFactoryUsesTenantResolverScope(): Promise<string> {
  const previous = Bun.env.RTC_E2E_FAKE_PROVIDER;
  Bun.env.RTC_E2E_FAKE_PROVIDER = "1";

  try {
    const calls: TenantResolutionInput[] = [];
    const factory = createVoiceSessionFactory(optionsWithResolver(calls));
    const session = await factory(request(), {});
    const config = session.config as VoiceSessionConfig;
    const input = calls.at(0);

    assert(input?.channel === "voice", "resolver input must bind voice channel");
    assert(input.provider === "gemini", "resolver input must include requested provider");
    assert(input.callId === "conversation-a", "resolver input must include call id");
    assert(input.accountId === "request-user", "resolver input must include account id");
    assert(config.tenantId === "tenant-resolved", "session must use resolver tenant");
    assert(config.userId === "user-resolved", "session must use resolver user");
    assert(config.providerId === "openai", "session must use resolver provider");
    assert(config.sampleRate === 24_000, "session must use resolver provider sample rate");
    assert(config.maxDurationMs === 123_000, "session must use resolver limits");
  } finally {
    if (previous === undefined) delete Bun.env.RTC_E2E_FAKE_PROVIDER;
    else Bun.env.RTC_E2E_FAKE_PROVIDER = previous;
  }

  return "session-factory-uses-tenant-resolver-scope";
}

async function scenarioSessionFactoryRejectsUnknownMediaBridge(): Promise<string> {
  const previous = Bun.env.RTC_E2E_FAKE_PROVIDER;
  Bun.env.RTC_E2E_FAKE_PROVIDER = "1";

  try {
    const factory = createVoiceSessionFactory(
      optionsWithResolver([], { mediaBridgeId: "missing-bridge" }),
    );
    const error = await captureError(() => factory(request(), {}));

    assert(
      error?.message.includes('No media bridge configured for tenant "tenant-resolved"'),
      `resolver media bridge must be validated, got ${error?.message ?? "success"}`,
    );
  } finally {
    if (previous === undefined) delete Bun.env.RTC_E2E_FAKE_PROVIDER;
    else Bun.env.RTC_E2E_FAKE_PROVIDER = previous;
  }

  return "session-factory-validates-resolver-media-bridge";
}

function optionsWithResolver(
  calls: TenantResolutionInput[] = [],
  overrides: Partial<TenantResolutionResult> = {},
): StarterVoiceServiceOptions {
  return {
    ...voiceOptions({
      providerCatalog: providerCatalog(),
      sdk: sdk(),
    }),
    tenantResolver: {
      resolveTenant(input: TenantResolutionInput): TenantResolutionResult {
        calls.push(input);
        const promptVariables = {
          tenantId: "tenant-resolved",
          providerId: "openai",
          planId: "pro",
          userId: "user-resolved",
          ...overrides.promptVariables,
        };
        return {
          tenantId: "tenant-resolved",
          providerId: "openai",
          mediaBridgeId: "browser",
          planId: "pro",
          userId: "user-resolved",
          limits: { maxDurationMs: 123_000 },
          promptVariables,
          ...overrides,
        };
      },
    },
  };
}

function optionsWithoutCompiledPrompt(
  overrides: Partial<TenantResolutionResult> = {},
): StarterVoiceServiceOptions {
  const options = optionsWithResolver([], overrides);
  return {
    ...options,
    builderService: {
      ...options.builderService,
      getCompiledArtifact: () => undefined,
    },
  };
}

function request(): BrowserVoiceSessionRequest {
  return {
    sessionId: "session-a",
    provider: "gemini",
    agent: "draft-solid",
    conversationId: "conversation-a",
    user: {
      tenantId: "request-tenant",
      userId: "request-user",
      planId: "request-plan",
    },
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
    providers: [
      providerDefinition("gemini", "gemini-live"),
      providerDefinition("openai", "openai-realtime"),
    ],
    mediaBridges: [{
      id: "browser",
      kind: "browser-websocket",
      providerId: "gemini",
      inputEncoding: "pcm16",
      outputEncoding: "pcm16",
      sampleRate: 24_000,
    }],
    plans: [{ id: "pro", label: "Pro" }],
    prompts: [{
      id: "voice",
      channels: ["voice"],
      priority: 1,
      body:
        "Tenant {{tenantId}} Provider {{providerId}} Plan {{planId}} " +
        "User {{userId}} Segment {{segment}}",
    }],
    tools: [],
    databases: [],
    stores: [],
    onboarding: [],
    packs: [],
  });
}

function providerDefinition(
  id: "gemini" | "openai",
  kind: "gemini-live" | "openai-realtime",
) {
  return {
    id,
    kind,
    model: `${id}-model`,
    voice: `${id}-voice`,
    apiKey: { name: `${id.toUpperCase()}_KEY` },
  };
}

function providerCatalog(): RuntimeProviderConfig[] {
  return [
    runtimeProvider("gemini", "gemini-live", 16_000),
    runtimeProvider("openai", "openai-realtime", 24_000),
  ];
}

function runtimeProvider(
  id: "gemini" | "openai",
  kind: "gemini-live" | "openai-realtime",
  inputSampleRate: number,
): RuntimeProviderConfig {
  return {
    id,
    label: id,
    kind,
    requiredEnv: [`${id.toUpperCase()}_KEY`],
    enabled: true,
    models: [`${id}-model`],
    voices: [`${id}-voice`],
    defaultModel: `${id}-model`,
    defaultVoice: `${id}-voice`,
    inputSampleRate,
    outputSampleRate: 24_000,
  };
}

async function captureError(
  action: () => Promise<unknown>,
): Promise<Error | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
