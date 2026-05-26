import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isAgentDraft } from "./domain/drafts.js";
import type { BuilderSessionState } from "./types.js";
import { asRecord, readChunkCount, readString } from "./utils.js";

const draftStatePath = join(process.cwd(), ".builder-state", "drafts.json");
const sessionStatePath = join(process.cwd(), ".builder-state", "session.json");
const drafts = loadDrafts();
const builderSession = loadBuilderSession();

export function requireDraft(draftId: string): AgentBuildDraft {
  const draft = drafts.get(draftId);
  if (!draft) throw new Error(`Unknown builder draft "${draftId}"`);
  return draft;
}

export function getDraft(draftId: string): AgentBuildDraft | undefined {
  return drafts.get(draftId);
}

export function resolveDraft(body: unknown): AgentBuildDraft {
  const draftId = readString(body, "draftId");
  const existing = drafts.get(draftId);
  if (existing) return existing;

  const candidate = asRecord(body).draft;
  if (isAgentDraft(candidate)) {
    saveDraft(candidate);
    return candidate;
  }

  return requireDraft(draftId);
}

export function saveDraft(draft: AgentBuildDraft): void {
  drafts.set(draft.id, draft);
  persistDrafts();
}

export function setActiveDraft(draftId: string): void {
  builderSession.activeDraftId = draftId;
  builderSession.updatedAt = new Date().toISOString();
  persistBuilderSession();
}

export function activeCompiledDraft(): AgentBuildDraft | undefined {
  if (builderSession.activeDraftId) {
    const active = drafts.get(builderSession.activeDraftId);
    if (active?.compiled) return active;
  }
  return latestCompiledDraft();
}

export function builderAgentBankPayload(): Record<string, unknown> {
  const activeDraft = activeCompiledDraft();
  return {
    activeDraftId: activeDraft?.id ?? null,
    agents: agentBankItems(activeDraft?.id),
  };
}

export function builderSessionPayload(): Record<string, unknown> {
  const draft = activeCompiledDraft();
  if (draft?.compiled && builderSession.activeDraftId !== draft.id) {
    builderSession.activeDraftId = draft.id;
    builderSession.updatedAt = draft.compiled.createdAt;
    persistBuilderSession();
  }
  return {
    activeDraftId: draft?.id ?? null,
    updatedAt: builderSession.updatedAt ?? null,
    artifact: draft?.compiled ?? null,
    draft: draft ? summarizeDraftForSession(draft) : null,
    available: compiledDraftSummaries(),
  };
}

function latestCompiledDraft(): AgentBuildDraft | undefined {
  return Array.from(drafts.values())
    .filter((draft) => Boolean(draft.compiled))
    .sort((left, right) => {
      const leftTime = Date.parse(left.compiled?.createdAt ?? "");
      const rightTime = Date.parse(right.compiled?.createdAt ?? "");
      return (rightTime || 0) - (leftTime || 0);
    })[0];
}

function compiledDraftSummaries(): Array<Record<string, unknown>> {
  return Array.from(drafts.values())
    .filter((draft) => Boolean(draft.compiled))
    .sort((left, right) => {
      const leftTime = Date.parse(left.compiled?.createdAt ?? "");
      const rightTime = Date.parse(right.compiled?.createdAt ?? "");
      return (rightTime || 0) - (leftTime || 0);
    })
    .map((draft) => ({
      draftId: draft.id,
      publicAgentName: draft.identity.publicAgentName,
      status: draft.status,
      createdAt: draft.compiled?.createdAt,
      knowledge: draft.compiled?.knowledge,
      selectedTools: draft.compiled?.selectedTools,
    }));
}

function agentBankItems(
  activeDraftId: string | undefined,
): Array<Record<string, unknown>> {
  return Array.from(drafts.values())
    .sort((left, right) => {
      const leftTime = Date.parse(
        left.compiled?.createdAt ?? left.updatedAt ?? left.createdAt,
      );
      const rightTime = Date.parse(
        right.compiled?.createdAt ?? right.updatedAt ?? right.createdAt,
      );
      return (rightTime || 0) - (leftTime || 0);
    })
    .slice(0, 24)
    .map((draft) => summarizeDraftForBank(draft, activeDraftId));
}

function summarizeDraftForBank(
  draft: AgentBuildDraft,
  activeDraftId: string | undefined,
): Record<string, unknown> {
  return {
    draftId: draft.id,
    kind: draft.compiled ? "compiled" : "draft",
    publicAgentName: draft.identity.publicAgentName,
    intent: draft.identity.intent,
    status: draft.status,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    active: activeDraftId === draft.id,
    canRunRtc: Boolean(draft.compiled),
    knowledge: draft.compiled?.knowledge ?? summarizePlannedKnowledge(draft),
    database: draft.databasePlan
      ? {
          schemaName: draft.databasePlan.schemaName,
          status: draft.databasePlan.status,
          appliedAt: draft.databasePlan.appliedAt,
        }
      : null,
    selectedTools: draft.compiled?.selectedTools ?? draft.selectedTools,
    promptChars:
      draft.compiled?.prompt.length ??
      draft.promptParts.final?.length ??
      draft.promptParts.tools?.length ??
      draft.promptParts.part1?.length ??
      0,
  };
}

function summarizePlannedKnowledge(
  draft: AgentBuildDraft,
): Record<string, unknown> | null {
  if (!draft.knowledgePlan) return null;
  return {
    strategy: draft.knowledgePlan.strategy,
    status: draft.status,
    documentCount: draft.knowledgePlan.documents.length,
    chunkCount: readKnowledgeChunkCount(draft.metadata),
  };
}

function readKnowledgeChunkCount(
  metadata: Record<string, unknown> | undefined,
): number | undefined {
  const store = asRecord(metadata?.knowledgeStore);
  const value = store.chunkCount;
  return typeof value === "number" ? value : undefined;
}

function summarizeDraftForSession(draft: AgentBuildDraft): Record<string, unknown> {
  return {
    id: draft.id,
    status: draft.status,
    identity: draft.identity,
    selectedTools: draft.selectedTools,
    knowledge: draft.compiled?.knowledge,
    database: draft.databasePlan
      ? {
          schemaName: draft.databasePlan.schemaName,
          status: draft.databasePlan.status,
          appliedAt: draft.databasePlan.appliedAt,
        }
      : null,
    promptChars: draft.compiled?.prompt.length ?? 0,
  };
}

function loadDrafts(): Map<string, AgentBuildDraft> {
  if (!existsSync(draftStatePath)) return new Map();
  try {
    const raw = readFileSync(draftStatePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed
        .filter(isAgentDraft)
        .map((draft): [string, AgentBuildDraft] => [draft.id, draft]),
    );
  } catch (error) {
    console.warn("Failed to load builder draft state:", error);
    return new Map();
  }
}

function loadBuilderSession(): BuilderSessionState {
  if (!existsSync(sessionStatePath)) return {};
  try {
    const raw = readFileSync(sessionStatePath, "utf8");
    const parsed = asRecord(JSON.parse(raw) as unknown);
    return {
      activeDraftId: readString(parsed, "activeDraftId") || undefined,
      updatedAt: readString(parsed, "updatedAt") || undefined,
    };
  } catch (error) {
    console.warn("Failed to load builder session state:", error);
    return {};
  }
}

function persistBuilderSession(): void {
  try {
    mkdirSync(dirname(sessionStatePath), { recursive: true });
    writeFileSync(sessionStatePath, JSON.stringify(builderSession, null, 2));
  } catch (error) {
    console.warn("Failed to persist builder session state:", error);
  }
}

function persistDrafts(): void {
  try {
    mkdirSync(dirname(draftStatePath), { recursive: true });
    writeFileSync(
      draftStatePath,
      JSON.stringify(Array.from(drafts.values()), null, 2),
    );
  } catch (error) {
    console.warn("Failed to persist builder draft state:", error);
  }
}
