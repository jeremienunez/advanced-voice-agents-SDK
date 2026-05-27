export interface AgentEvolutionSummary {
  version: number;
  currentArtifactId?: string | null;
  rollbackAvailable: boolean;
  lastLearningRun: {
    runId: string;
    status: string;
    at: string;
    sourceSessionId?: string | null;
  } | null;
}
