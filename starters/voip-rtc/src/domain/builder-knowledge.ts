export interface KnowledgeDocument {
  id: string;
  name: string;
  kind: "txt" | "md" | "pdf" | "xlsx" | "xls" | "web_research" | "unknown";
  mimeType?: string;
  sizeBytes?: number;
  text?: string;
  status: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeResearchBudget {
  maxQueriesPerCycle: number;
  maxSources: number;
  maxEstimatedTokens: number;
  maxEstimatedCostUsd: number;
}

export interface KnowledgeResearchCheckpoint {
  id: string;
  label: string;
  status: "planned" | "running" | "completed" | "failed";
  at: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeResearchResult {
  status: string;
  budget: KnowledgeResearchBudget;
  spend: {
    cycles: number;
    queries: number;
    sources: number;
    estimatedTokens: number;
    estimatedCostUsd: number;
  };
  documents: KnowledgeDocument[];
  cycles: Array<{
    id: string;
    objective: string;
    queries: string[];
    status: string;
    sourceCount: number;
    estimatedTokens: number;
    estimatedCostUsd: number;
    documentId?: string;
    checkpoints?: KnowledgeResearchCheckpoint[];
    warnings?: string[];
  }>;
  checkpoints?: KnowledgeResearchCheckpoint[];
  stopReason?: string;
  warnings?: string[];
}
