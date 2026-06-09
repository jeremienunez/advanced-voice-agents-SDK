import type { JsonObject } from "./json.js";

export type KnowledgeStrategy =
  | "vector"
  | "lexical"
  | "hybrid"
  | "raptor"
  | "kg"
  | "hybrid_kg";

export type KnowledgeDocumentKind =
  | "txt"
  | "md"
  | "pdf"
  | "xlsx"
  | "xls"
  | "web_research"
  | "unknown";

export type KnowledgeDocumentStatus =
  | "pending"
  | "parsed"
  | "unsupported"
  | "planned"
  | "ingested"
  | "failed";

export interface KnowledgeDocument {
  id: string;
  name: string;
  kind: KnowledgeDocumentKind;
  mimeType?: string;
  sizeBytes?: number;
  text?: string;
  status: KnowledgeDocumentStatus;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface KnowledgeResearchBudget {
  maxCycles: number;
  maxQueriesPerCycle: number;
  maxSources: number;
  maxEstimatedTokens: number;
  maxEstimatedCostUsd: number;
}

export interface KnowledgeResearchIntent {
  objective: string;
  queries: string[];
}

export interface KnowledgeResearchCheckpoint {
  id: string;
  label: string;
  status: "planned" | "running" | "completed" | "failed";
  at: string;
  detail?: string;
  metadata?: JsonObject;
}

export interface KnowledgeResearchCycle {
  id: string;
  objective: string;
  queries: string[];
  status: "planned" | "running" | "completed" | "skipped" | "failed";
  sourceCount: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  documentId?: string;
  checkpoints?: KnowledgeResearchCheckpoint[];
  warnings?: string[];
}

export interface KnowledgeResearchSpend {
  cycles: number;
  queries: number;
  sources: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
}

export interface KnowledgeResearchResult {
  status: "completed" | "blocked" | "budget-exhausted" | "failed";
  budget: KnowledgeResearchBudget;
  spend: KnowledgeResearchSpend;
  documents: KnowledgeDocument[];
  cycles: KnowledgeResearchCycle[];
  checkpoints?: KnowledgeResearchCheckpoint[];
  stopReason?: string;
  warnings?: string[];
}

export interface KnowledgeVerificationVerdict {
  status: "sufficient" | "needs_more_data" | "failed";
  confidence: number;
  reasons: string[];
  missingTopics: string[];
  recommendedQueries: string[];
  coverageMatrix?: Array<{
    topic: string;
    status: "covered" | "weak" | "missing";
    evidence: string[];
    followUp: string[];
  }>;
  artifactTables?: Array<{
    name: string;
    purpose: string;
    recommendedFormat: "markdown" | "csv" | "xlsx";
    columns: string[];
    rows: string[][];
  }>;
  enrichmentMarkdown?: string;
  warnings?: string[];
  raw?: JsonObject;
}

export interface KnowledgeChunkingPlan {
  method: "fixed" | "semantic" | "recursive" | "raptor";
  targetTokens: number;
  overlapTokens: number;
  rationale?: string;
}

export interface KnowledgeIndexPlan {
  id: string;
  kind: "vector" | "lexical" | "graph";
  fields: string[];
  metric?: "cosine" | "dot" | "euclidean";
  dimensions?: number;
  implementation?: string;
}

export interface KnowledgeGraphPlan {
  enabled: boolean;
  entityTypes: string[];
  relationTypes: string[];
  rationale?: string;
}

export interface KnowledgeBuildPlan {
  strategy: KnowledgeStrategy;
  alternativeStrategies: KnowledgeStrategy[];
  documents: KnowledgeDocument[];
  chunking: KnowledgeChunkingPlan;
  indexes: KnowledgeIndexPlan[];
  kg: KnowledgeGraphPlan;
  reasons: string[];
  validationRequired: boolean;
  warnings?: string[];
  raw?: JsonObject;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  ordinal: number;
  text: string;
  tokenEstimate: number;
  metadata?: Record<string, unknown>;
}
