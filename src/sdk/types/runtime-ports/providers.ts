import type { ProviderDefinition } from "../core/index.js";

export interface ProviderFactoryInput<TTool = unknown> {
  definition: ProviderDefinition;
  requestedModel?: string;
  requestedVoice?: string;
  instructions: string;
  tools: readonly TTool[];
  metadata?: Record<string, unknown>;
}

export interface ProviderFactoryPort<TProvider = unknown, TTool = unknown> {
  createProvider(input: ProviderFactoryInput<TTool>): TProvider;
}
