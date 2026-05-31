import type {
  AgentEvolutionInput,
  AgentLearningLoopOptions,
  AgentLearningLoopPort,
  LearningLoopEnqueueOptions,
  LearningRunRecord,
  LearningRunStatus,
  LearningSessionInput,
  SessionLearningSignals,
  TemporalMemoryRecord,
} from "../types.js";
import { normalizeLearningLoopProfile } from "./in-memory-run-repository.js";

const terminalStatuses = new Set<LearningRunStatus>([
  "evaluated",
  "applied",
  "pending_approval",
  "rejected",
  "failed",
  "skipped",
]);

export function createAgentLearningLoop(
  options: AgentLearningLoopOptions,
): AgentLearningLoopPort {
  return {
    enqueueSessionLearning(input, enqueueOptions) {
      const duplicate = options.repository.findBySource?.({
        sourceSessionId: input.summary.sessionId,
        agentId: input.agentId,
        draftId: input.draftId,
      });
      if (isPromise(duplicate)) {
        return duplicate.then((resolved) =>
          enqueueAfterDuplicate(options, enqueueOptions, input, resolved)
        );
      }
      return enqueueAfterDuplicate(
        options,
        enqueueOptions,
        input,
        duplicate ?? null,
      );
    },

    getLearningRun(runId) {
      return options.repository.get(runId);
    },
  };
}

function enqueueAfterDuplicate(
  options: AgentLearningLoopOptions,
  enqueueOptions: LearningLoopEnqueueOptions | undefined,
  input: LearningSessionInput,
  duplicate: LearningRunRecord | null,
): Promise<LearningRunRecord> | LearningRunRecord {
  if (duplicate) return duplicate;

  const profile = normalizeLearningLoopProfile(
    enqueueOptions?.profile,
    options.defaultProfile ?? "memory_only",
  );
  const queued = options.repository.createQueued(input, {
    profile,
    runId: input.runId ?? `learn_${crypto.randomUUID()}`,
    jobId: `job_${crypto.randomUUID()}`,
  });
  if (isPromise(queued)) {
    return queued.then((run) => {
      scheduleLearningRun(options, enqueueOptions, input, run);
      return run;
    });
  }
  scheduleLearningRun(options, enqueueOptions, input, queued);
  return queued;
}

function scheduleLearningRun(
  options: AgentLearningLoopOptions,
  enqueueOptions: LearningLoopEnqueueOptions | undefined,
  input: LearningSessionInput,
  run: LearningRunRecord,
): void {
  void publish(options, enqueueOptions, run);
  setTimeout(() => {
    void executeLearningRun(options, enqueueOptions, input, run);
  }, 0);
}

async function executeLearningRun(
  options: AgentLearningLoopOptions,
  enqueueOptions: LearningLoopEnqueueOptions | undefined,
  input: LearningSessionInput,
  queued: LearningRunRecord,
): Promise<void> {
  const running = await publish(options, enqueueOptions, {
    ...queued,
    status: "running",
    startedAt: new Date().toISOString(),
    message: "Learning loop running.",
  });

  try {
    const draftId = input.draftId ?? input.agentId;
    if (!draftId) {
      await publish(options, enqueueOptions, {
        ...running,
        status: "skipped",
        finishedAt: new Date().toISOString(),
        message: "No agent or draft id was attached to the session.",
      });
      return;
    }

    const signals = await options.extractor.extract(input);
    const decision = await options.policy.decide({
      profile: running.profile,
      input,
      signals,
    });
    const shouldWriteMemory = shouldWriteLearningArtifacts(decision.action);
    const memories = shouldWriteMemory
      ? await writeMemory(options, input, draftId, signals)
      : [];
    if (shouldWriteMemory) await writeGraph(options, input, draftId, signals);

    const evaluated = await publish(options, enqueueOptions, {
      ...running,
      status: "evaluated",
      evaluatedAt: new Date().toISOString(),
      decision,
      message: decision.reason,
    });

    if (decision.action === "reject") {
      await publish(options, enqueueOptions, {
        ...evaluated,
        status: "rejected",
        finishedAt: new Date().toISOString(),
        message: decision.reason,
      });
      return;
    }
    if (decision.action === "pending_approval") {
      await publish(options, enqueueOptions, {
        ...evaluated,
        status: "pending_approval",
        finishedAt: new Date().toISOString(),
        message: decision.reason,
      });
      return;
    }
    if (decision.action !== "apply" || !options.evolution) return;

    const evolution = await options.evolution.validateAndApply(
      evolutionInput(input, evaluated.runId, draftId, memories, signals),
    );
    await publish(options, enqueueOptions, {
      ...evaluated,
      status: evolution.status === "applied" ? "applied" : "skipped",
      finishedAt: new Date().toISOString(),
      message: evolution.reason,
    });
  } catch (error) {
    await publish(options, enqueueOptions, {
      ...running,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      message: "Learning loop failed.",
    });
  }
}

async function writeMemory(
  options: AgentLearningLoopOptions,
  input: LearningSessionInput,
  draftId: string,
  signals: SessionLearningSignals,
): Promise<TemporalMemoryRecord[]> {
  if (!options.memoryStore) return [];
  await options.memoryStore.ensure?.();
  return options.memoryStore.write({
    scope: {
      tenantId: input.tenantId,
      agentId: draftId,
      userId: input.userId,
    },
    records: signals.memories.map((memory) => ({
      ...memory,
      sourceSessionId: input.summary.sessionId,
    })),
  });
}

async function writeGraph(
  options: AgentLearningLoopOptions,
  input: LearningSessionInput,
  draftId: string,
  signals: SessionLearningSignals,
): Promise<void> {
  if (!options.graphStore) return;
  try {
    await options.graphStore.ensure?.();
    await options.graphStore.upsert({
      tenantId: input.tenantId,
      agentId: draftId,
      userId: input.userId,
      sourceSessionId: input.summary.sessionId,
      nodes: signals.graph.nodes,
      edges: signals.graph.edges,
    });
  } catch {
    // Graph memory is optional for the embedded SDK loop.
  }
}

function evolutionInput(
  input: LearningSessionInput,
  runId: string,
  draftId: string,
  memories: TemporalMemoryRecord[],
  signals: SessionLearningSignals,
): AgentEvolutionInput {
  return {
    runId,
    draftId,
    agentId: input.agentId,
    tenantId: input.tenantId,
    userId: input.userId,
    sourceSessionId: input.summary.sessionId,
    memories,
    graph: signals.graph,
    recommendations: {
      prompt: signals.promptRecommendation,
      tools: signals.missingTools,
      retrievalWeights: signals.retrievalWeights,
    },
  };
}

async function publish(
  options: AgentLearningLoopOptions,
  enqueueOptions: LearningLoopEnqueueOptions | undefined,
  status: LearningRunRecord,
): Promise<LearningRunRecord> {
  const saved = await options.repository.save(status);
  await options.statusSink?.publish(saved);
  enqueueOptions?.onStatus?.(saved);
  return saved;
}

function shouldWriteLearningArtifacts(
  action: LearningRunRecord["decision"] extends infer T
    ? T extends { action: infer A } ? A : never
    : never,
): boolean {
  return action === "write_memory" ||
    action === "candidate" ||
    action === "apply" ||
    action === "pending_approval";
}

function isPromise<T>(value: T | Promise<T> | undefined): value is Promise<T> {
  return Boolean(value && typeof (value as Promise<T>).then === "function");
}
