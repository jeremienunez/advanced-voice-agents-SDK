import type {
  AgentEvolutionResult,
  ActiveAgentAssignmentPort,
  ActiveAgentScope,
  LearningJobStatus,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import {
  createAgentLearningLoop,
  createDefaultLearningPolicy,
  extractDefaultSessionLearningSignals,
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
import {
  createLocalLearningRunRepository,
  learningProfileFromEnv,
} from "./run-state.js";

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
  const repository = createLocalLearningRunRepository();
  const profile = learningProfileFromEnv(env);
  const loop = createAgentLearningLoop({
    repository,
    extractor: { extract: extractDefaultSessionLearningSignals },
    policy: createDefaultLearningPolicy(),
    memoryStore,
    graphStore,
    evolution,
    defaultProfile: profile,
  });

  return {
    approveInfraEvolution(draftId, pendingId, scope) {
      return evolution.approveInfraEvolution(draftId, pendingId, scope);
    },

    enqueueSessionLearning(input, onStatus) {
      if (isTemporalLearningDriver(env)) {
        return createTemporalPort(onStatus).enqueueLearningSession(input);
      }
      return loop.enqueueSessionLearning(input, {
        profile,
        onStatus,
      }) as LearningJobStatus;
    },

    getLearningStatus(runId) {
      if (!isTemporalLearningDriver(env)) {
        return loop.getLearningRun(runId) as LearningJobStatus | null;
      }
      return createTemporalPort().getLearningStatus(runId);
    },

    rollback(draftId, scope) {
      return evolution.rollback(draftId, scope);
    },
  };

  function createTemporalPort(onStatus?: LearningStatusSink) {
    const workflow = new LearnFromSessionWorkflow({
      memoryStore,
      graphStore,
      evolution,
      memoryTtlSeconds,
    });
    return createLearningWorkflowPort({
      env,
      workflow,
      onStatus,
      temporalClient: options.temporalClient,
    });
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function isTemporalLearningDriver(env: Record<string, string | undefined>): boolean {
  return env.AGENT_LEARNING_WORKFLOW_DRIVER === "temporal";
}
