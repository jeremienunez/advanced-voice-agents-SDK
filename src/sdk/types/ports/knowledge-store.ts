import type { AgentBuildDraft } from "../draft.js";
import type { RuntimeDatabaseCredentialRef } from "../infra/index.js";
import type { KnowledgeChunk, KnowledgeDocument } from "../knowledge.js";

export interface EmbeddingInput {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingVector {
  id: string;
  values: number[];
  dimensions: number;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingPort {
  embed(input: EmbeddingInput[]): Promise<EmbeddingVector[]>;
}

export interface KnowledgeStoreCompileInput {
  draft: AgentBuildDraft;
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
  embeddings: EmbeddingVector[];
}

export interface KnowledgeStoreCompileResult {
  storeId: string;
  documentCount: number;
  chunkCount: number;
  vectorIndexId?: string;
  lexicalIndexId?: string;
}

export type KnowledgeSearchMode = "lexical" | "vector" | "hybrid";

export interface KnowledgeSearchScope {
  draftId: string;
  schemaName?: string;
  storeId?: string;
  databaseCredentialRef?: RuntimeDatabaseCredentialRef;
}

export interface KnowledgeSearchInput {
  scope: KnowledgeSearchScope;
  query: string;
  mode?: KnowledgeSearchMode;
  limit?: number;
  embedding?: number[];
}

export interface KnowledgeSearchResultItem {
  chunkId: string;
  documentId: string;
  documentName: string;
  ordinal: number;
  content: string;
  score: number;
  lexicalScore?: number;
  vectorScore?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchResult {
  status: "ok" | "not-configured" | "not-compiled" | "empty";
  query: string;
  mode: KnowledgeSearchMode;
  resultCount: number;
  results: KnowledgeSearchResultItem[];
}

export interface KnowledgeSearchPort {
  isConfigured(): boolean;
  search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult>;
}

export interface DatabaseCredentialResolverPort {
  resolveDatabaseUrl(
    ref: RuntimeDatabaseCredentialRef,
  ): Promise<string | undefined> | string | undefined;
}

export interface KnowledgeStorePort {
  isConfigured(): boolean;
  ensureSchema?(): Promise<void>;
  compile(input: KnowledgeStoreCompileInput): Promise<KnowledgeStoreCompileResult>;
}
