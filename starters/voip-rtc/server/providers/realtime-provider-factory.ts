import type {
  ProviderFactoryInput,
  ProviderFactoryPort,
  SecretResolverPort,
} from "@voiceagentsdk/core/sdk";
import {
  createCascadedRealtimeTransport,
  GeminiRealtimeTransport,
  GrokRealtimeTransport,
  type IRealtimeProvider,
  OpenAIRealtimeTransport,
  type VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import {
  resolveCatalogOption,
  runtimeProvider,
  type RuntimeProviderConfig,
} from "./catalog.js";
import { resolveRequiredSecret } from "../secrets/index.js";
import {
  E2EFakeRealtimeProvider,
  isE2EFakeProviderEnabled,
} from "./e2e-fake-provider.js";

export interface StarterProviderFactoryOptions {
  providerCatalog: RuntimeProviderConfig[];
  secretResolver: SecretResolverPort;
}

export function createStarterProviderFactory(
  options: StarterProviderFactoryOptions,
): ProviderFactoryPort<IRealtimeProvider, VoiceSessionTool> {
  return {
    createProvider(input) {
      return createProvider(input, options);
    },
  };
}

export function createProvider(
  input: ProviderFactoryInput<VoiceSessionTool>,
  options: StarterProviderFactoryOptions,
): IRealtimeProvider {
  const runtime = runtimeProvider(options.providerCatalog, input.definition.id);
  const model = resolveCatalogOption(
    "model",
    input.requestedModel ?? input.definition.model,
    runtime.models,
    runtime.defaultModel,
  );
  const voice = resolveCatalogOption(
    "voice",
    input.requestedVoice ?? input.definition.voice,
    runtime.voices,
    runtime.defaultVoice,
  );
  const tools = providerTools(input.tools);

  if (isE2EFakeProviderEnabled()) return new E2EFakeRealtimeProvider();

  const apiKey = providerApiKey(input, runtime.requiredEnv, options);

  if (input.definition.kind === "openai-realtime") {
    return new OpenAIRealtimeTransport({
      apiKey,
      model: model as never,
      voice: voice as never,
      inputFormat: "pcm16",
      instructions: input.instructions,
      tools,
      noiseReduction: "near_field",
    });
  }
  if (input.definition.kind === "gemini-live") {
    return new GeminiRealtimeTransport({
      apiKey,
      model: model as never,
      voice: voice as never,
      instructions: input.instructions,
      tools,
    });
  }
  if (input.definition.kind === "grok-realtime") {
    return new GrokRealtimeTransport({
      apiKey,
      voice: voice as never,
      instructions: input.instructions,
      tools,
    });
  }
  if (input.definition.kind === "cascaded") {
    return createCascadedRealtimeTransport({
      apiKey,
      mode: cascadedMode(input.definition.options?.mode),
      llmModel: model,
      ttsVoice: voice,
      instructions: input.instructions,
      tools,
    });
  }
  throw new Error(`Unsupported starter provider "${input.definition.kind}"`);
}

function providerTools(tools: readonly VoiceSessionTool[]) {
  return tools.map(({ execute: _execute, ...tool }) => tool);
}

function providerApiKey(
  input: ProviderFactoryInput<VoiceSessionTool>,
  aliases: readonly string[],
  options: StarterProviderFactoryOptions,
): string {
  return resolveRequiredSecret(options.secretResolver, {
    ref: input.definition.apiKey ?? {
      name: aliases[0] ?? `${input.definition.id}.apiKey`,
    },
    aliases,
    purpose: "realtime-provider-api-key",
    metadata: {
      providerId: input.definition.id,
      providerKind: input.definition.kind,
    },
  });
}

function cascadedMode(value: unknown): "cascade" | "moe-stt" | "moe-full" {
  return value === "moe-stt" || value === "moe-full" ? value : "cascade";
}
