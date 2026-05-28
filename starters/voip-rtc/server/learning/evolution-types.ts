import type {
  AgentInfraPlan,
  CompiledAgentArtifact,
} from "@voiceagentsdk/core/sdk";

export type EvolutionAuditAction =
  | "apply"
  | "approve_infra"
  | "pending_infra"
  | "rollback";

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
  action: EvolutionAuditAction;
  fromVersion?: number;
  toVersion: number;
  createdAt: string;
  reason: string;
}

export interface PendingInfraEvolution {
  id: string;
  runId: string;
  sourceSessionId: string;
  status: "pending" | "approved";
  proposedPlan: AgentInfraPlan;
  approvalReasons: string[];
  createdAt: string;
  approvedAt?: string;
}

export interface AgentEvolutionMetadata {
  version: number;
  currentArtifactId: string;
  rollbackArtifactId?: string;
  rollbackArtifact?: CompiledAgentArtifact;
  versions: EvolutionVersion[];
  audits: EvolutionAudit[];
  pendingInfraEvolution?: PendingInfraEvolution;
  lastLearningRun?: {
    runId: string;
    status: string;
    at: string;
    sourceSessionId: string;
  };
}
