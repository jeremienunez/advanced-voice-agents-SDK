import type {
  AgentBuilderLlmProvider,
  DatabasePlannerPort,
  DatabaseProvisionerPort,
  DocumentIngestionPort,
  EmbeddingPort,
  KnowledgeResearchBudget,
  KnowledgeResearchPort,
  KnowledgeVerifierPort,
  KnowledgeStorePort,
  PromptPlannerPort,
  ToolRegistryItem,
} from "@voiceagentsdk/core/sdk";
import type { strategyLabels } from "./catalog.js";

export interface BuilderServiceOptions {
  port: number;
  corsHeaders: Record<string, string>;
  composition?: BuilderServiceComposition;
}

export interface BuilderConfig {
  defaults: {
    deepseekModel: string;
    deepseekBaseUrl: string;
    promptProvider: AgentBuilderLlmProvider;
    researchProvider: string;
    researchModel: string;
    voyageEmbeddingModel: string;
    voyageEmbeddingDimensions: number;
    knowledgeVerificationProvider: string;
    knowledgeVerificationModel: string;
    knowledgeVerificationPasses: number;
    researchBudget: KnowledgeResearchBudget;
  };
  availability: {
    deepseek: boolean;
    voyage: boolean;
    knowledgeStore: boolean;
    databaseProvisioner: boolean;
    research: boolean;
    knowledgeVerifier: boolean;
  };
  toolRegistry: ToolRegistryItem[];
  strategies: typeof strategyLabels;
  providers: {
    prompt: BuilderProviderOption[];
    research: BuilderProviderOption[];
    verification: BuilderProviderOption[];
  };
}

export interface BuilderProviderOption {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: string[];
  notes?: string[];
}

export interface BuilderRouteResult {
  response: Response | null;
}

export interface BuilderSessionState {
  activeDraftId?: string;
  updatedAt?: string;
}

export type BuilderPlannerPort = PromptPlannerPort & DatabasePlannerPort;

export interface ConfigurableKnowledgeResearchPort
  extends KnowledgeResearchPort {
  isConfigured(settings?: { provider?: string; model?: string }): boolean;
}

export interface BuilderWorkflowDependencies {
  planner: BuilderPlannerPort;
  embeddings: EmbeddingPort;
  ingestion: DocumentIngestionPort;
  knowledgeStore: KnowledgeStorePort;
  databaseProvisioner: DatabaseProvisionerPort;
  research: ConfigurableKnowledgeResearchPort;
  knowledgeVerifier?: KnowledgeVerifierPort;
  knowledgeVerificationPasses: number;
  deepseekModel: string;
  voyageConfigured: boolean;
  toolRegistry: ToolRegistryItem[];
}

export interface BuilderServiceComposition {
  config: BuilderConfig;
  workflows: BuilderWorkflowDependencies;
}
