import type {
  CompiledVoiceAgentSdk,
  EmbeddingPort,
  KnowledgeSearchPort,
  ProviderFactoryPort,
  SecretResolverPort,
  TenantResolverPort,
} from "@voiceagentsdk/core/sdk";
import type {
  IRealtimeProvider,
  VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import type { createBuilderService } from "../builder/index.js";
import type { RuntimeProviderConfig } from "../providers/catalog.js";
import type { StarterLearningService } from "../learning/service.js";

export type BuilderService = ReturnType<typeof createBuilderService>;
export type StarterSdk = CompiledVoiceAgentSdk;

export interface RuntimeKnowledge {
  embeddings: EmbeddingPort;
  embeddingAvailable: boolean;
  search: KnowledgeSearchPort;
}

export interface StarterVoiceServiceOptions {
  builderService: BuilderService;
  browserSampleRate: number;
  providerCatalog: RuntimeProviderConfig[];
  providerFactory: ProviderFactoryPort<IRealtimeProvider, VoiceSessionTool>;
  runtimeKnowledge?: RuntimeKnowledge;
  learning?: StarterLearningService;
  secretResolver: SecretResolverPort;
  tenantResolver: TenantResolverPort;
  sdk: StarterSdk;
}
