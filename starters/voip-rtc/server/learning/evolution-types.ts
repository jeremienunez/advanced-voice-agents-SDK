import type { CompiledAgentArtifact } from "@voiceagentsdk/core/sdk";

export interface EvolutionVersion {
  version: number;
  artifactId: string;
  runId?: string;
  sourceSessionId?: string;
  createdAt: string;
  reason: string;
}

export interface EvolutionAudit {
  id: string;
  runId?: string;
  action: "apply" | "rollback";
  fromVersion?: number;
  toVersion: number;
  createdAt: string;
  reason: string;
}

export interface AgentEvolutionMetadata {
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
