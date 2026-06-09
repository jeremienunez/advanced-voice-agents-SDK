import type { AgentBuildDraft } from "../draft.js";
import type {
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchIntent,
  KnowledgeResearchResult,
  KnowledgeVerificationVerdict,
} from "../knowledge.js";

export interface KnowledgeResearchRequest {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
  budget?: Partial<KnowledgeResearchBudget>;
  settings?: {
    provider?: string;
    model?: string;
    researchIntents?: KnowledgeResearchIntent[];
  };
}

export interface KnowledgeVerificationRequest {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
  research?: KnowledgeResearchResult;
  settings?: {
    provider?: string;
    model?: string;
  };
}

export interface KnowledgeResearchPort {
  growKnowledge(input: KnowledgeResearchRequest): Promise<KnowledgeResearchResult>;
}

export interface KnowledgeVerifierPort {
  isConfigured?(): boolean;
  verifyKnowledge(
    input: KnowledgeVerificationRequest,
  ): Promise<KnowledgeVerificationVerdict>;
}
