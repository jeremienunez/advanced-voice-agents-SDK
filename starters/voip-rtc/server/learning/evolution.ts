import type {
  AgentBuildDraft,
  AgentEvolutionInput,
  AgentEvolutionPort,
  AgentEvolutionResult,
  CompiledAgentArtifact,
} from "@voiceagentsdk/core/sdk";
import { mutateDraft } from "../builder/domain/drafts.js";
import {
  requireDraft,
  saveDraft,
  setActiveDraft,
} from "../builder/state.js";
import { asRecord } from "../builder/utils.js";

interface EvolutionVersion {
  version: number;
  artifactId: string;
  runId?: string;
  sourceSessionId?: string;
  createdAt: string;
  reason: string;
}

interface EvolutionAudit {
  id: string;
  runId?: string;
  action: "apply" | "rollback";
  fromVersion?: number;
  toVersion: number;
  createdAt: string;
  reason: string;
}

interface AgentEvolutionMetadata {
  version: number;
  currentArtifactId: string;
  rollbackArtifactId?: string;
  rollbackArtifact?: CompiledAgentArtifact;
  versions: EvolutionVersion[];
  audits: EvolutionAudit[];
  lastLearningRun?: {
    runId: string;
    status: string;
    at: string;
    sourceSessionId: string;
  };
}

export class StarterAgentEvolution implements AgentEvolutionPort {
  async validateAndApply(
    input: AgentEvolutionInput,
  ): Promise<AgentEvolutionResult> {
    const draft = requireDraft(input.draftId);
    if (!draft.compiled) {
      return {
        status: "skipped",
        draftId: draft.id,
        version: currentEvolution(draft).version,
        reason: "Draft is not compiled.",
      };
    }

    const now = new Date().toISOString();
    const current = currentEvolution(draft);
    const nextVersion = current.version + 1;
    const artifactId = artifactIdFor(draft.id, nextVersion);
    const previousArtifactId = current.currentArtifactId ||
      artifactIdFor(draft.id, current.version);
    const prompt = buildPromptVersion(draft.compiled.prompt, input);
    const nextArtifact: CompiledAgentArtifact = {
      ...draft.compiled,
      prompt,
      createdAt: now,
    };
    const nextEvolution: AgentEvolutionMetadata = {
      version: nextVersion,
      currentArtifactId: artifactId,
      rollbackArtifactId: previousArtifactId,
      rollbackArtifact: draft.compiled,
      versions: [
        ...current.versions,
        {
          version: nextVersion,
          artifactId,
          runId: input.runId,
          sourceSessionId: input.sourceSessionId,
          createdAt: now,
          reason: "Applied post-session learning.",
        },
      ],
      audits: [
        ...current.audits,
        {
          id: `audit_${crypto.randomUUID()}`,
          runId: input.runId,
          action: "apply",
          fromVersion: current.version,
          toVersion: nextVersion,
          createdAt: now,
          reason: "Auto-applied validated learned memory.",
        },
      ],
      lastLearningRun: {
        runId: input.runId,
        status: "applied",
        at: now,
        sourceSessionId: input.sourceSessionId,
      },
    };
    const nextDraft = mutateDraft(draft)
      .finalPrompt(prompt)
      .compiled(nextArtifact)
      .metadata({
        agentEvolution: nextEvolution,
        learningMemory: {
          lastRunId: input.runId,
          memoryIds: input.memories.map((memory) => memory.id),
          graphNodeCount: input.graph.nodes.length,
          graphEdgeCount: input.graph.edges.length,
        },
        retrievalWeights: input.recommendations.retrievalWeights ?? {},
      })
      .build();

    saveDraft(nextDraft);
    setActiveDraft(nextDraft.id);
    return {
      status: "applied",
      draftId: nextDraft.id,
      version: nextVersion,
      previousVersion: current.version,
      artifactId,
      rollbackArtifactId: previousArtifactId,
      auditId: nextEvolution.audits.at(-1)?.id,
      reason: "Applied post-session learning.",
    };
  }

  async rollback(draftId: string): Promise<AgentEvolutionResult> {
    const draft = requireDraft(draftId);
    const current = currentEvolution(draft);
    if (!current.rollbackArtifact) {
      return {
        status: "skipped",
        draftId,
        version: current.version,
        reason: "No rollback artifact is available.",
      };
    }

    const now = new Date().toISOString();
    const nextVersion = current.version + 1;
    const artifactId = artifactIdFor(draft.id, nextVersion);
    const rollbackArtifact = {
      ...current.rollbackArtifact,
      createdAt: now,
    };
    const nextEvolution: AgentEvolutionMetadata = {
      ...current,
      version: nextVersion,
      currentArtifactId: artifactId,
      rollbackArtifactId: current.currentArtifactId,
      rollbackArtifact: draft.compiled,
      versions: [
        ...current.versions,
        {
          version: nextVersion,
          artifactId,
          createdAt: now,
          reason: "Rollback to previous compiled artifact.",
        },
      ],
      audits: [
        ...current.audits,
        {
          id: `audit_${crypto.randomUUID()}`,
          action: "rollback",
          fromVersion: current.version,
          toVersion: nextVersion,
          createdAt: now,
          reason: "Manual rollback from Agent Bank.",
        },
      ],
    };
    const nextDraft = mutateDraft(draft)
      .finalPrompt(rollbackArtifact.prompt)
      .compiled(rollbackArtifact)
      .metadata({ agentEvolution: nextEvolution })
      .build();

    saveDraft(nextDraft);
    setActiveDraft(nextDraft.id);
    return {
      status: "applied",
      draftId,
      version: nextVersion,
      previousVersion: current.version,
      artifactId,
      rollbackArtifactId: current.currentArtifactId,
      auditId: nextEvolution.audits.at(-1)?.id,
      reason: "Rolled back to previous compiled artifact.",
    };
  }
}

function currentEvolution(draft: AgentBuildDraft): AgentEvolutionMetadata {
  const raw = asRecord(draft.metadata?.agentEvolution);
  const version = typeof raw.version === "number" && raw.version > 0
    ? raw.version
    : 1;
  const currentArtifactId = typeof raw.currentArtifactId === "string"
    ? raw.currentArtifactId
    : artifactIdFor(draft.id, version);
  return {
    version,
    currentArtifactId,
    rollbackArtifactId: typeof raw.rollbackArtifactId === "string"
      ? raw.rollbackArtifactId
      : undefined,
    rollbackArtifact: isCompiledArtifact(raw.rollbackArtifact)
      ? raw.rollbackArtifact
      : undefined,
    versions: Array.isArray(raw.versions)
      ? raw.versions.filter(isEvolutionVersion)
      : [{
          version,
          artifactId: currentArtifactId,
          createdAt: draft.compiled?.createdAt ?? draft.updatedAt,
          reason: "Initial compiled artifact.",
        }],
    audits: Array.isArray(raw.audits)
      ? raw.audits.filter(isEvolutionAudit)
      : [],
    lastLearningRun: isLastLearningRun(raw.lastLearningRun)
      ? raw.lastLearningRun
      : undefined,
  };
}

function buildPromptVersion(
  currentPrompt: string,
  input: AgentEvolutionInput,
): string {
  const memoryLines = input.memories
    .slice(0, 8)
    .map((memory) => `- ${memory.kind}: ${redact(memory.text)}`);
  const retrievalWeights = input.recommendations.retrievalWeights ?? {};
  const retrievalLine = Object.entries(retrievalWeights)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  const block = [
    "## Learned Session Memory",
    `Source session: ${input.sourceSessionId}`,
    ...memoryLines,
    retrievalLine ? `Retrieval weights: ${retrievalLine}` : "",
    "Use these notes as private operating context. Do not reveal raw memory IDs or audit details to users.",
  ].filter(Boolean).join("\n");
  return `${stripPreviousLearningBlock(currentPrompt).trim()}\n\n${block}`.trim();
}

function stripPreviousLearningBlock(prompt: string): string {
  return prompt.replace(/\n*## Learned Session Memory[\s\S]*$/m, "");
}

function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted-secret]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-secret]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[redacted-secret]")
    .slice(0, 600);
}

function artifactIdFor(draftId: string, version: number): string {
  return `artifact_${draftId}_v${version}`;
}

function isCompiledArtifact(value: unknown): value is CompiledAgentArtifact {
  const record = asRecord(value);
  return (
    typeof record.draftId === "string" &&
    typeof record.prompt === "string" &&
    Array.isArray(record.selectedTools)
  );
}

function isEvolutionVersion(value: unknown): value is EvolutionVersion {
  const record = asRecord(value);
  return (
    typeof record.version === "number" &&
    typeof record.artifactId === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.reason === "string"
  );
}

function isEvolutionAudit(value: unknown): value is EvolutionAudit {
  const record = asRecord(value);
  return (
    typeof record.id === "string" &&
    (record.action === "apply" || record.action === "rollback") &&
    typeof record.toVersion === "number" &&
    typeof record.createdAt === "string" &&
    typeof record.reason === "string"
  );
}

function isLastLearningRun(
  value: unknown,
): value is AgentEvolutionMetadata["lastLearningRun"] {
  const record = asRecord(value);
  return (
    typeof record.runId === "string" &&
    typeof record.status === "string" &&
    typeof record.at === "string" &&
    typeof record.sourceSessionId === "string"
  );
}
