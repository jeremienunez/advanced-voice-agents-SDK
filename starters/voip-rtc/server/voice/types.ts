import type {
  EmbeddingPort,
  KnowledgeSearchPort,
} from "@voiceagentsdk/core/sdk";
import type { createBuilderService } from "../builder/index.js";
import type { RuntimeProviderConfig } from "../providers/catalog.js";
import type { createStarterSdk } from "../app/starter-sdk.js";
import type { StarterLearningService } from "../learning/service.js";

export type BuilderService = ReturnType<typeof createBuilderService>;
export type StarterSdk = ReturnType<typeof createStarterSdk>;

export interface RuntimeKnowledge {
  embeddings: EmbeddingPort;
  embeddingAvailable: boolean;
  search: KnowledgeSearchPort;
}

export interface StarterVoiceServiceOptions {
  builderService: BuilderService;
  browserSampleRate: number;
  providerCatalog: RuntimeProviderConfig[];
  runtimeKnowledge?: RuntimeKnowledge;
  learning?: StarterLearningService;
  sdk: StarterSdk;
}
