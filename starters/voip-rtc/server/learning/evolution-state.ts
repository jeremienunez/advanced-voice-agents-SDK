import type {
  AgentBuildDraft,
  CompiledAgentArtifact,
} from "@voiceagentsdk/core/sdk";
import { asRecord } from "../builder/utils.js";
import type {
  AgentEvolutionMetadata,
  EvolutionAudit,
  EvolutionVersion,
} from "./evolution-types.js";

export function currentEvolution(
  draft: AgentBuildDraft,
): AgentEvolutionMetadata {
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

export function artifactIdFor(draftId: string, version: number): string {
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
