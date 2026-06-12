import type {
  AgentEvolutionPort,
  AgentEvolutionResult,
  GraphMemoryStorePort,
  LearningSessionInput,
  TemporalMemoryStorePort,
} from "@voiceagentsdk/core/sdk";
import { extractDefaultSessionLearningSignals } from "@voiceagentsdk/core/sdk";

export interface LearnFromSessionResult {
  status: "applied" | "skipped";
  memoryCount: number;
  graphNodeCount: number;
  graphEdgeCount: number;
  evolution: AgentEvolutionResult;
}

export interface LearnFromSessionRunner {
  learnFromSession(input: LearningSessionInput): Promise<LearnFromSessionResult>;
}

export class LearnFromSessionWorkflow implements LearnFromSessionRunner {
  constructor(
    private readonly deps: {
      memoryStore: TemporalMemoryStorePort;
      graphStore: GraphMemoryStorePort;
      evolution: AgentEvolutionPort;
      memoryTtlSeconds: number;
    },
  ) {}

  async learnFromSession(
    input: LearningSessionInput,
  ): Promise<LearnFromSessionResult> {
    const draftId = input.draftId ?? input.agentId;
    if (!draftId) {
      return {
        status: "skipped",
        memoryCount: 0,
        graphNodeCount: 0,
        graphEdgeCount: 0,
        evolution: {
          status: "skipped",
          draftId: "",
          version: 0,
          reason: "No draft id was attached to the RTC session.",
        },
      };
    }

    await this.deps.memoryStore.ensure?.();

    const learned = classifySession(input);
    const scope = {
      tenantId: input.tenantId,
      agentId: draftId,
      userId: input.userId,
    };
    const memories = await this.deps.memoryStore.write({
      scope,
      records: learned.memories.map((memory) => ({
        ...memory,
        sourceSessionId: input.summary.sessionId,
      })),
      ttlSeconds: this.deps.memoryTtlSeconds,
    });
    const graphResult = await this.writeGraphMemory(input, draftId, learned);
    const evolution = await this.deps.evolution.validateAndApply({
      runId: input.runId ?? `learn_${crypto.randomUUID()}`,
      draftId,
      agentId: input.agentId,
      tenantId: input.tenantId,
      userId: input.userId,
      sourceSessionId: input.summary.sessionId,
      memories,
      graph: {
        nodes: learned.nodes,
        edges: learned.edges,
      },
      recommendations: {
        prompt: learned.promptRecommendation,
        tools: learned.missingTools,
        retrievalWeights: learned.retrievalWeights,
      },
    });

    return {
      status: evolution.status === "applied" ? "applied" : "skipped",
      memoryCount: memories.length,
      graphNodeCount: graphResult.nodeCount,
      graphEdgeCount: graphResult.edgeCount,
      evolution,
    };
  }

  private async writeGraphMemory(
    input: LearningSessionInput,
    draftId: string,
    learned: ReturnType<typeof classifySession>,
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    try {
      await this.deps.graphStore.ensure?.();
      return await this.deps.graphStore.upsert({
        tenantId: input.tenantId,
        agentId: draftId,
        userId: input.userId,
        sourceSessionId: input.summary.sessionId,
        nodes: learned.nodes,
        edges: learned.edges,
      });
    } catch (error) {
      console.warn(
        "Graph memory unavailable; continuing learning:",
        error instanceof Error ? error.message : String(error),
      );
      return { nodeCount: 0, edgeCount: 0 };
    }
  }
}

function classifySession(input: LearningSessionInput) {
  const signals = extractDefaultSessionLearningSignals(input);
  return {
    memories: signals.memories,
    nodes: signals.graph.nodes,
    edges: signals.graph.edges,
    missingTools: signals.missingTools,
    promptRecommendation: signals.promptRecommendation
      ?? signals.memories.map((memory) => memory.text).join("\n"),
    retrievalWeights: signals.retrievalWeights,
  };
}
