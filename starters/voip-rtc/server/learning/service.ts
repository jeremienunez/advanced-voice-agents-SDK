import type {
  AgentEvolutionResult,
  ActiveAgentAssignmentPort,
  ActiveAgentScope,
  LearningJobStatus,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import { StarterAgentEvolution } from "./evolution.js";
import {
  createGraphMemoryStoreFromEnv,
  type CypherGraphClientPort,
} from "./graph-store.js";
import { createTemporalMemoryStoreFromEnv } from "./memory-store.js";
import {
  createLearningWorkflowPort,
  type TemporalWorkerClientPort,
} from "./temporal-worker.js";
import type { LearningStatusSink } from "./temporal-workflow.js";
import { LearnFromSessionWorkflow } from "./workflow.js";

export interface StarterLearningService {
  approveInfraEvolution(
    draftId: string,
    pendingId: string,
    scope?: ActiveAgentScope,
  ): Promise<AgentEvolutionResult>;
  enqueueSessionLearning(
    input: LearningSessionInput,
    onStatus?: LearningStatusSink,
  ): LearningJobStatus;
  getLearningStatus(runId: string): LearningJobStatus | null;
  rollback(draftId: string, scope?: ActiveAgentScope): Promise<AgentEvolutionResult>;
}

export function createStarterLearningServiceFromEnv(
  env: Record<string, string | undefined> = Bun.env,
  options: {
    activeAgentAssignment?: ActiveAgentAssignmentPort;
    graphClient?: CypherGraphClientPort;
    temporalClient?: TemporalWorkerClientPort;
  } = {},
): StarterLearningService {
  const memoryTtlSeconds = positiveInteger(
    env.AGENT_LEARNING_MEMORY_TTL_SECONDS,
    60 * 60 * 24 * 30,
  );
  const memoryStore = createTemporalMemoryStoreFromEnv(env, {
    defaultTtlSeconds: memoryTtlSeconds,
  });
  const graphStore = createGraphMemoryStoreFromEnv(env, {
    cypherClient: options.graphClient,
  });
  const evolution = new StarterAgentEvolution({
    activeAgentAssignment: options.activeAgentAssignment,
  });

  return {
    approveInfraEvolution(draftId, pendingId, scope) {
      return evolution.approveInfraEvolution(draftId, pendingId, scope);
    },

    enqueueSessionLearning(input, onStatus) {
      const workflow = new LearnFromSessionWorkflow({
        memoryStore,
        graphStore,
        evolution,
        memoryTtlSeconds,
      });
      const temporal = createLearningWorkflowPort({
        env,
        workflow,
        onStatus,
        temporalClient: options.temporalClient,
      });
      return temporal.enqueueLearningSession(input);
    },

    getLearningStatus(runId) {
      const workflow = new LearnFromSessionWorkflow({
        memoryStore,
        graphStore,
        evolution,
        memoryTtlSeconds,
      });
      const temporal = createLearningWorkflowPort({
        env,
        workflow,
        temporalClient: options.temporalClient,
      });
      return temporal.getLearningStatus(runId);
    },

    rollback(draftId, scope) {
      return evolution.rollback(draftId, scope);
    },
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
