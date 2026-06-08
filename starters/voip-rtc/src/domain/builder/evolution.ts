export interface AgentEvolutionSummary {
  version: number;
  currentArtifactId?: string | null;
  rollbackAvailable: boolean;
  pendingInfraEvolution?: {
    id: string;
    status: string;
    proposedPlanId?: string;
    computeTarget?: string;
    provisioningMode?: string;
    approvalReasons: string[];
    createdAt?: string;
  } | null;
  lastLearningRun: {
    runId: string;
    status: string;
    at: string;
    sourceSessionId?: string | null;
  } | null;
}
