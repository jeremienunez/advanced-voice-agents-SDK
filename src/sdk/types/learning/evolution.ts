import type { AgentInfraPlan } from "../infra/plan.js";
import type { GraphMemoryEdge, GraphMemoryNode } from "./graph-memory.js";
import type { TemporalMemoryRecord } from "./temporal-memory.js";

export interface AgentEvolutionInput {
  runId: string;
  draftId: string;
  agentId?: string;
  tenantId?: string;
  userId?: string;
  sourceSessionId: string;
  memories: TemporalMemoryRecord[];
  graph: {
    nodes: GraphMemoryNode[];
    edges: GraphMemoryEdge[];
  };
  recommendations: {
    prompt?: string;
    tools?: string[];
    infraPlan?: AgentInfraPlan;
    retrievalWeights?: Record<string, number>;
  };
}

export interface AgentEvolutionResult {
  status: "applied" | "skipped" | "failed";
  draftId: string;
  version: number;
  previousVersion?: number;
  artifactId?: string;
  rollbackArtifactId?: string;
  auditId?: string;
  reason: string;
}

export interface AgentEvolutionPort {
  validateAndApply(input: AgentEvolutionInput): Promise<AgentEvolutionResult>;
  rollback?(draftId: string): Promise<AgentEvolutionResult>;
}
