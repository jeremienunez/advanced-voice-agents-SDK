import type {
  CompiledVoiceAgentSdk,
  EmbeddingPort,
  KnowledgeSearchPort,
  MemoryStorePort,
  PromptCompilerPort,
  ProviderFactoryPort,
  SecretResolverPort,
  TenantResolverPort,
} from "@voiceagentsdk/core/sdk";
import type {
  IRealtimeProvider,
  VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import type { BrowserVoiceMediaBridgeFactory } from "@voiceagentsdk/core/server/browser";
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
  mediaBridgeFactory?: BrowserVoiceMediaBridgeFactory;
  providerCatalog: RuntimeProviderConfig[];
  providerFactory: ProviderFactoryPort<IRealtimeProvider, VoiceSessionTool>;
  promptCompiler: PromptCompilerPort;
  runtimeKnowledge?: RuntimeKnowledge;
  learning?: StarterLearningService;
  memoryStore?: MemoryStorePort;
  secretResolver: SecretResolverPort;
  tenantResolver: TenantResolverPort;
  sdk: StarterSdk;
}
