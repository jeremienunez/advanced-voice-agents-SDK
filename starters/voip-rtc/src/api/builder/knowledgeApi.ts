import type {
  AgentBuildDraft,
  BuilderResearchSettings,
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchResult,
} from "../../domain/builder.js";
import { getJson, postForm, postJson } from "../http.js";

export function ingestDocument(apiBase: string, formData: FormData) {
  return postForm<{ document: KnowledgeDocument }>(
    `${apiBase}/ingest-document`,
    formData,
  );
}

export function fetchKnowledgeDocument(
  apiBase: string,
  draftId: string,
  documentId: string,
) {
  return getJson<{ document: KnowledgeDocument }>(
    `${apiBase}/drafts/${encodeURIComponent(draftId)}/documents/${encodeURIComponent(documentId)}`,
  );
}

export function createKnowledgePlan(
  apiBase: string,
  draft: AgentBuildDraft,
  documents: KnowledgeDocument[],
) {
  return postJson<{ draft: AgentBuildDraft }>(`${apiBase}/knowledge-plan`, {
    draftId: draft.id,
    draft,
    documents,
  });
}

export function runAutonomousResearch(
  apiBase: string,
  draft: AgentBuildDraft,
  documents: KnowledgeDocument[],
  budget: KnowledgeResearchBudget,
  research: BuilderResearchSettings,
) {
  return postJson<{
    status: string;
    reason?: string;
    document?: KnowledgeDocument;
    documents?: KnowledgeDocument[];
    research?: KnowledgeResearchResult;
  }>(`${apiBase}/run-research`, {
    draftId: draft.id,
    draft,
    documents,
    budget,
    research,
  });
}

export function buildAutonomousKnowledge(
  apiBase: string,
  draft: AgentBuildDraft,
  documents: KnowledgeDocument[],
  budget: KnowledgeResearchBudget,
  research: BuilderResearchSettings,
) {
  return postJson<{
    status: string;
    draft: AgentBuildDraft;
    documents: KnowledgeDocument[];
    research?: KnowledgeResearchResult;
    verification?: unknown[];
    steps?: Array<{ name: string; status: string; detail?: string }>;
  }>(`${apiBase}/autonomous-knowledge`, {
    draftId: draft.id,
    draft,
    documents,
    budget,
    research,
  });
}

export function compileKnowledgeStore(apiBase: string, draft: AgentBuildDraft) {
  return postJson<{
    status: string;
    reason?: string;
    draft?: AgentBuildDraft;
  }>(`${apiBase}/compile-knowledge`, { draftId: draft.id, draft });
}
