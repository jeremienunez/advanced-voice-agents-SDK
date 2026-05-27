import type {
  AgentInfraPlan,
  AgentBuilderLlmProvider,
  AuthTicketIdentity,
  DatabasePlannerPort,
  DatabaseProvisionerPort,
  DocumentIngestionPort,
  EmbeddingPort,
  InfraPlannerPort,
  InfraProvisionerPort,
  InfraIacBundle,
  KnowledgeResearchBudget,
  KnowledgeResearchPort,
  KnowledgeVerifierPort,
  KnowledgeStorePort,
  PromptPlannerPort,
  ToolRegistryItem,
} from "@voiceagentsdk/core/sdk";
import type { strategyLabels } from "./catalog.js";
import type { DocumentIngestionQuotaPort } from "./quotas/document-ingestion-quota.js";

export interface BuilderServiceOptions {
  port: number;
  corsHeaders: Record<string, string> | ((request: Request) => Record<string, string>);
  composition?: BuilderServiceComposition;
}

export interface BuilderConfig {
  defaults: {
    promptProvider: AgentBuilderLlmProvider;
    promptModel: string;
    researchProvider: string;
    researchModel: string;
    voyageEmbeddingModel: string;
    voyageEmbeddingDimensions: number;
    documentParseTimeoutMs: number;
    documentIngestionQuotaPerIp: number;
    documentIngestionQuotaWindowMs: number;
    knowledgeVerificationProvider: string;
    knowledgeVerificationModel: string;
    knowledgeVerificationPasses: number;
    researchBudget: KnowledgeResearchBudget;
  };
  availability: {
    deepseek: boolean;
    qwen: boolean;
    kimi: boolean;
    gemini: boolean;
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

export interface BuilderRequestContext {
  identity?: AuthTicketIdentity;
  clientIp?: string;
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

export interface ConfigurableKnowledgeVerifierPort
  extends KnowledgeVerifierPort {
  isConfigured(settings?: { provider?: string; model?: string }): boolean;
}

export interface InfraIacGeneratorPort {
  createBundle(plan: AgentInfraPlan): InfraIacBundle;
}

export interface BuilderWorkflowDependencies {
  planner: BuilderPlannerPort;
  embeddings: EmbeddingPort;
  ingestion: DocumentIngestionPort;
  documentParseTimeoutMs: number;
  documentIngestionQuota: DocumentIngestionQuotaPort;
  knowledgeStore: KnowledgeStorePort;
  databaseProvisioner: DatabaseProvisionerPort;
  infraPlanner: InfraPlannerPort;
  infraProvisioner: InfraProvisionerPort;
  infraIacGenerator: InfraIacGeneratorPort;
  research: ConfigurableKnowledgeResearchPort;
  knowledgeVerifier?: ConfigurableKnowledgeVerifierPort;
  knowledgeVerificationPasses: number;
  knowledgeVerificationProvider: string;
  knowledgeVerificationModel: string;
  promptProvider: AgentBuilderLlmProvider;
  promptModel: string;
  researchProvider: string;
  researchModel: string;
  voyageConfigured: boolean;
  toolRegistry: ToolRegistryItem[];
  availableSecretNames: string[];
}

export interface BuilderServiceComposition {
  config: BuilderConfig;
  workflows: BuilderWorkflowDependencies;
}
