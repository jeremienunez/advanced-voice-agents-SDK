import type {
  AgentBankResponse,
  AgentBuildDraft,
  BuilderConfig,
  BuilderResearchSettings,
  BuilderDraftResponse,
  BuilderIdentity,
  BuilderSessionResponse,
  CompiledAgentSummary,
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchResult,
} from "../domain/builder.js";
import { fetchWithNetworkError, postForm, postJson, readError } from "./http.js";

export async function fetchBuilderConfig(
  apiBase: string,
  signal?: AbortSignal,
): Promise<BuilderConfig> {
  const response = await fetchWithNetworkError(`${apiBase}/config`, { signal });
  if (!response.ok) {
    throw new Error(`Builder config failed with ${response.status}`);
  }
  return (await response.json()) as BuilderConfig;
}

export async function fetchBuilderSession(
  apiBase: string,
  signal?: AbortSignal,
): Promise<BuilderSessionResponse | null> {
  const response = await fetchWithNetworkError(`${apiBase}/session`, { signal });
  if (!response.ok) return null;
  return (await response.json()) as BuilderSessionResponse;
}

export function createPromptPlan(apiBase: string, identity: BuilderIdentity) {
  return postJson<{ draft: AgentBuildDraft }>(`${apiBase}/prompt-plan`, {
    identity,
  });
}

export function savePromptClarifications(
  apiBase: string,
  draft: AgentBuildDraft,
  answers: Record<string, string>,
) {
  return postJson<{ draft: AgentBuildDraft }>(`${apiBase}/prompt-clarifications`, {
    draftId: draft.id,
    answers,
    acceptUnanswered: true,
  });
}

export function ingestDocument(apiBase: string, formData: FormData) {
  return postForm<{ document: KnowledgeDocument }>(
    `${apiBase}/ingest-document`,
    formData,
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

export function createDatabasePlan(
  apiBase: string,
  draft: AgentBuildDraft,
  documents: KnowledgeDocument[],
) {
  return postJson<{ draft: AgentBuildDraft }>(`${apiBase}/database-plan`, {
    draftId: draft.id,
    draft,
    documents,
  });
}

export function applyDatabasePlan(apiBase: string, draft: AgentBuildDraft) {
  return postJson<{
    status: string;
    reason?: string;
    draft?: AgentBuildDraft;
  }>(`${apiBase}/apply-database`, { draftId: draft.id, draft });
}

export function compileKnowledgeStore(apiBase: string, draft: AgentBuildDraft) {
  return postJson<{
    status: string;
    reason?: string;
    draft?: AgentBuildDraft;
  }>(`${apiBase}/compile-knowledge`, { draftId: draft.id, draft });
}

export function compileAgentSpec(
  apiBase: string,
  draft: AgentBuildDraft,
  selectedTools: string[],
) {
  return postJson<{
    draft: AgentBuildDraft;
    artifact: CompiledAgentSummary;
  }>(`${apiBase}/compile-agent`, {
    draftId: draft.id,
    draft,
    selectedTools,
  });
}

export async function fetchAgents(apiBase: string): Promise<AgentBankResponse> {
  const response = await fetch(`${apiBase}/agents`);
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail || `Agent bank failed with ${response.status}`);
  }
  return (await response.json()) as AgentBankResponse;
}

export function activateAgentSession(apiBase: string, draftId: string) {
  return postJson<BuilderSessionResponse>(`${apiBase}/session`, { draftId });
}

export function rollbackAgentVersion(apiBase: string, draftId: string) {
  return postJson<{
    status: string;
    draftId: string;
    version: number;
    reason: string;
  }>(`${apiBase}/agents/rollback`, { draftId });
}

export async function fetchDraft(
  apiBase: string,
  draftId: string,
): Promise<BuilderDraftResponse> {
  const response = await fetch(`${apiBase}/drafts/${encodeURIComponent(draftId)}`);
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail || `Draft request failed with ${response.status}`);
  }
  return (await response.json()) as BuilderDraftResponse;
}
