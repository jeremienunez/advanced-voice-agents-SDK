import type {
  ProviderDefinition,
  TenantResolutionResult,
} from "@voiceagentsdk/core/sdk";
import {
  GeminiRealtimeTransport,
  type IRealtimeProvider,
  OpenAIRealtimeTransport,
  type VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import {
  resolveCatalogOption,
  runtimeProvider,
} from "../providers/catalog.js";
import { resolveRequiredSecret } from "../secrets/index.js";
import {
  E2EFakeRealtimeProvider,
  isE2EFakeProviderEnabled,
} from "./e2e-fake-provider.js";
import { instructionsForRequest } from "./instructions.js";
import type { StarterVoiceServiceOptions } from "./types.js";

export function createProvider(
  definition: ProviderDefinition,
  request: { agent?: string; model?: string; voice?: string },
  tools: VoiceSessionTool[],
  options: StarterVoiceServiceOptions,
  tenant?: TenantResolutionResult,
): IRealtimeProvider {
  const runtime = runtimeProvider(options.providerCatalog, definition.id);
  const model = resolveCatalogOption(
    "model",
    request.model ?? definition.model,
    runtime.models,
    runtime.defaultModel,
  );
  const voice = resolveCatalogOption(
    "voice",
    request.voice ?? definition.voice,
    runtime.voices,
    runtime.defaultVoice,
  );
  const instructions = instructionsForRequest(
    definition.id,
    request.agent,
    options,
    tenant,
  );

  if (isE2EFakeProviderEnabled()) {
    return new E2EFakeRealtimeProvider();
  }

  if (definition.kind === "openai-realtime") {
    return new OpenAIRealtimeTransport({
      apiKey: providerApiKey(definition, runtime.requiredEnv, options),
      model: model as never,
      voice: voice as never,
      inputFormat: "pcm16",
      instructions,
      tools: providerTools(tools),
      noiseReduction: "near_field",
    });
  }

  if (definition.kind === "gemini-live") {
    return new GeminiRealtimeTransport({
      apiKey: providerApiKey(definition, runtime.requiredEnv, options),
      model: model as never,
      voice: voice as never,
      instructions,
      tools: providerTools(tools),
    });
  }

  throw new Error(`Unsupported starter provider "${definition.kind}"`);
}

function providerTools(tools: VoiceSessionTool[]) {
  return tools.map(({ execute: _execute, ...tool }) => tool);
}

function providerApiKey(
  definition: ProviderDefinition,
  aliases: readonly string[],
  options: StarterVoiceServiceOptions,
): string {
  return resolveRequiredSecret(options.secretResolver, {
    ref: definition.apiKey ?? { name: aliases[0] ?? `${definition.id}.apiKey` },
    aliases,
    purpose: "realtime-provider-api-key",
    metadata: {
      providerId: definition.id,
      providerKind: definition.kind,
    },
  });
}
