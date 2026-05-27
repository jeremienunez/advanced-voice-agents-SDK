import type {
  AgentEvolutionInput,
  AgentEvolutionPort,
  AgentEvolutionResult,
  AgentBuildDraft,
  AgentInfraPlan,
  DatabaseBuildPlan,
  LearningJobStatus,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import { IntentInfraPlanner } from "../server/builder/domain/infra.js";
import { LocalGraphMemoryStore } from "../server/learning/graph-store.js";
import { LocalRedisTemporalMemoryStore } from "../server/learning/memory-store.js";
import { LocalTemporalWorkflowPort } from "../server/learning/temporal-workflow.js";
import { LearnFromSessionWorkflow } from "../server/learning/workflow.js";

interface ScenarioResult {
  scenario: string;
  claims: string[];
}

const results: ScenarioResult[] = [];

await scenario(
  "Given learning is enabled in dev infra, when the planner runs, then it exposes every required store without provisioning them upfront",
  async () => {
    const plan = infraPlan({
      learningEnabled: true,
      configured: true,
    });
    const disabled = infraPlan({
      learningEnabled: false,
      configured: true,
    });
    const missingConfig = infraPlan({
      learningEnabled: true,
      configured: false,
    });

    assert(plan.storePlan?.enabled, "learning store plan must be present when learning is enabled");
    assert(plan.storePlan.createOn === "session_end", "stores must be created only at session end");
    assert(plan.storePlan.temporalWorkflow.provider === "temporal", "Temporal workflow store must be planned");
    assert(plan.storePlan.temporalMemory.provider === "redis", "Redis temporal memory store must be planned");
    assert(plan.storePlan.graphMemory.kind === "graph_memory", "graph memory store must be planned");
    assert(plan.storePlan.auditStore.kind === "audit_source", "audit/source store must be planned");
    assert(plan.storePlan.guardrails.appendOnlyVersions, "append-only version guardrail must be explicit");
    assert(plan.storePlan.guardrails.rollbackPointer, "rollback pointer guardrail must be explicit");
    assert(plan.storePlan.guardrails.redactSecrets, "secret redaction guardrail must be explicit");
    assert(
      plan.security.secretRefs.includes("REDIS_URL") &&
        plan.security.secretRefs.includes("TEMPORAL_ADDRESS") &&
        plan.security.secretRefs.includes("DATABASE_URL"),
      "learning required env refs must be included in infra security secret refs",
    );
    assert(!disabled.storePlan, "learning store plan must disappear when learning is disabled");
    assert(
      (missingConfig.warnings ?? []).some((warning) => warning.includes("REDIS_URL")) &&
        (missingConfig.warnings ?? []).some((warning) => warning.includes("TEMPORAL_ADDRESS")) &&
        (missingConfig.warnings ?? []).some((warning) => warning.includes("DATABASE_URL")),
      "missing Redis/Temporal/Postgres config must be falsifiable through warnings",
    );

    return [
      "planned Temporal, Redis, graph and audit stores",
      "kept createOn=session_end instead of eager provisioning",
      "exposed append-only, rollback and redaction guardrails",
      "disabled store plan when learning is disabled",
      "surfaced missing env as warnings",
    ];
  },
);

await scenario(
  "Given a Temporal learning queue, when jobs apply or fail, then status progression is observable and failures stay async",
  async () => {
    const appliedRun = await runTemporalScenario(
      successfulWorkflow() as unknown as LearnFromSessionWorkflow,
      learningSession({
        transcriptText: "I prefer concise answers for Acme Routes.",
        toolStatus: "completed",
      }),
    );
    const applied = appliedRun.terminal;
    const appliedStatuses = appliedRun.statuses;

    assert(applied.status === "applied", "successful Temporal job must finish applied");
    assert(
      appliedStatuses.join(">") === "queued>running>applied",
      `successful Temporal status order is wrong: ${appliedStatuses.join(">")}`,
    );

    const failedRun = await runTemporalScenario(
      failingWorkflow() as unknown as LearnFromSessionWorkflow,
      learningSession({
        runId: "learn-bdd-failure",
        transcriptText: "I prefer concise answers for Acme Routes.",
        toolStatus: "completed",
      }),
    );
    const failed = failedRun.terminal;
    const failedStatuses = failedRun.statuses;

    assert(failed.status === "failed", "failing Temporal job must finish failed");
    assert(failed.error?.includes("intentional bdd failure"), "failure status must expose the workflow error");
    assert(
      failedStatuses.join(">") === "queued>running>failed",
      `failed Temporal status order is wrong: ${failedStatuses.join(">")}`,
    );

    return [
      "observed queued/running/applied",
      "observed queued/running/failed",
      "converted workflow throw into failed status",
      "kept failure in async learning status path",
    ];
  },
);

await scenario(
  "Given a completed RTC session, when learning runs, then memory, graph and version evolution become observable",
  async () => {
    const memoryStore = new LocalRedisTemporalMemoryStore();
    const graphStore = new LocalGraphMemoryStore();
    const evolution = new RecordingEvolution();
    const workflow = new LearnFromSessionWorkflow({
      memoryStore,
      graphStore,
      evolution,
      memoryTtlSeconds: 60,
    });
    const input = learningSession({
      transcriptText:
        "I prefer concise answers. My project is Acme Routes. api_key=sk-test-secret-value",
      toolStatus: "failed",
      toolError: "Unknown tool create_invoice",
    });

    const first = await workflow.learnFromSession(input);
    const scopedMemory = await memoryStore.list({
      tenantId: "tenant-a",
      agentId: "draft-agent-a",
      userId: "user-a",
    });

    assert(first.status === "applied", "learning must apply for a compiled draft session");
    assert(first.memoryCount >= 4, "learning must write summary, preference, failed intent and missing-tool memory");
    assert(first.graphNodeCount >= 4, "learning must create agent/session/user/entity graph nodes");
    assert(first.graphEdgeCount >= 3, "learning must create learned_from/participated/mentions edges");
    assert(first.evolution.version === 2, "first learning run must append agent version 2");
    assert(scopedMemory.length === first.memoryCount, "memory must be retrievable by tenant/agent/user scope");
    assert(
      scopedMemory.every((record) => record.expiresAt && Date.parse(record.expiresAt) > Date.parse(record.createdAt)),
      "every temporal memory must carry a future TTL expiry",
    );
    assert(
      scopedMemory.every((record) => !record.text.includes("sk-test-secret-value")),
      "learned memory must redact secret-looking values",
    );
    assert(
      evolution.lastInput?.recommendations.tools?.includes("create_invoice"),
      "missing tool recommendations must preserve the failed tool name",
    );
    assert(
      typeof evolution.lastInput?.recommendations.retrievalWeights?.temporal === "number",
      "retrieval weights must be generated for follow-up retrieval",
    );

    const nodeCountAfterFirst = graphStore.nodeCount;
    const edgeCountAfterFirst = graphStore.edgeCount;
    const second = await workflow.learnFromSession({
      ...input,
      runId: "learn-bdd-session-a-repeat",
    });

    assert(second.evolution.version === 3, "second learning run must append version 3, not overwrite version 2");
    assert(graphStore.nodeCount === nodeCountAfterFirst, "replaying the same session must not duplicate graph nodes");
    assert(graphStore.edgeCount === edgeCountAfterFirst, "replaying the same session must not duplicate graph edges");

    return [
      "applied learning for a real draft session",
      "wrote scoped TTL memory with secret redaction",
      "upserted graph memory idempotently",
      "surfaced missing-tool and retrieval-weight recommendations",
      "appended versions 2 and 3 without overwrite",
    ];
  },
);

await scenario(
  "Given a session without an agent or draft id, when learning runs, then it is skipped and produces no side effects",
  async () => {
    const memoryStore = new LocalRedisTemporalMemoryStore();
    const graphStore = new LocalGraphMemoryStore();
    const evolution = new RecordingEvolution();
    const workflow = new LearnFromSessionWorkflow({
      memoryStore,
      graphStore,
      evolution,
      memoryTtlSeconds: 60,
    });
    const input = learningSession({
      draftId: null,
      agentId: null,
      transcriptText: "I prefer concise answers for Acme Routes.",
      toolStatus: "completed",
    });

    const result = await workflow.learnFromSession(input);
    const memory = await memoryStore.list({ tenantId: "tenant-a" });

    assert(result.status === "skipped", "learning must skip sessions that cannot be tied to a draft");
    assert(memory.length === 0, "skipped learning must not write temporal memory");
    assert(graphStore.nodeCount === 0, "skipped learning must not write graph nodes");
    assert(graphStore.edgeCount === 0, "skipped learning must not write graph edges");
    assert(evolution.calls.length === 0, "skipped learning must not invoke agent evolution");

    return [
      "skipped orphan session",
      "left memory store empty",
      "left graph store empty",
      "did not invoke evolution",
    ];
  },
);

console.log(JSON.stringify({ status: "ok", style: "bdd-popperian", results }, null, 2));

async function scenario(
  name: string,
  run: () => Promise<string[]>,
): Promise<void> {
  try {
    results.push({ scenario: name, claims: await run() });
  } catch (error) {
    fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

class RecordingEvolution implements AgentEvolutionPort {
  readonly calls: AgentEvolutionInput[] = [];
  lastInput: AgentEvolutionInput | null = null;
  private version = 1;

  async validateAndApply(input: AgentEvolutionInput): Promise<AgentEvolutionResult> {
    this.calls.push(input);
    this.lastInput = input;

    assert(input.memories.length > 0, "evolution requires learned memories");
    assert(input.graph.nodes.length > 0, "evolution requires graph nodes");
    assert(input.graph.edges.length > 0, "evolution requires graph edges");
    assert(
      input.memories.every((memory) => !memory.text.includes("sk-test-secret-value")),
      "evolution must never receive unredacted secret-looking memories",
    );

    this.version += 1;
    return {
      status: "applied",
      draftId: input.draftId,
      version: this.version,
      previousVersion: this.version - 1,
      artifactId: `artifact_${input.draftId}_v${this.version}`,
      rollbackArtifactId: `artifact_${input.draftId}_v${this.version - 1}`,
      auditId: `audit_${input.runId}`,
      reason: "BDD fake evolution accepted learning payload.",
    };
  }
}

function learningSession(options: {
  agentId?: string | null;
  draftId?: string | null;
  runId?: string;
  transcriptText: string;
  toolStatus: "completed" | "failed";
  toolError?: string;
}): LearningSessionInput {
  return {
    runId: options.runId ?? "learn-bdd-session-a",
    agentId: options.agentId === null
      ? undefined
      : options.agentId ?? "draft-agent-a",
    draftId: options.draftId === null
      ? undefined
      : options.draftId ?? "draft-agent-a",
    tenantId: "tenant-a",
    userId: "user-a",
    summary: {
      sessionId: "session-bdd-a",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      startedAt: 1_000,
      endedAt: 9_000,
      durationMs: 8_000,
      messageCount: 1,
      toolCallCount: 1,
      endReason: "completed",
    },
    transcript: [
      {
        role: "user",
        text: options.transcriptText,
        isFinal: true,
        timestamp: 2_000,
      },
    ],
    toolCalls: [
      {
        callId: "call-bdd-a",
        toolName: "create_invoice",
        arguments: { account: "Acme Routes" },
        startedAt: 3_000,
        completedAt: 4_000,
        status: options.toolStatus,
        result: options.toolStatus === "completed" ? { ok: true } : undefined,
        error: options.toolError,
      },
    ],
  };
}

function infraPlan(options: {
  learningEnabled: boolean;
  configured: boolean;
}): AgentInfraPlan {
  return new IntentInfraPlanner({
    databaseUrl: options.configured ? "postgres://local/test" : undefined,
    learningEnabled: options.learningEnabled,
    redisUrl: options.configured ? "redis://localhost:6379" : undefined,
    temporalAddress: options.configured ? "localhost:7233" : undefined,
    temporalNamespace: options.configured ? "default" : undefined,
    temporalTaskQueue: options.configured ? "agent-learning" : undefined,
  }).createInfraPlan({
    draft: draft("learning-bdd", "Self-improve after RTC sessions"),
    databasePlan: databasePlan("learning_bdd"),
  });
}

function draft(id: string, intent: string): AgentBuildDraft {
  return {
    id: `draft_${id}`,
    status: "draft",
    identity: {
      builderFirstName: "BDD",
      builderLastName: "Tester",
      publicAgentName: `Learning ${id}`,
      intent,
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    toolRegistry: [],
    selectedTools: [],
    promptParts: {},
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function databasePlan(id: string): DatabaseBuildPlan {
  return {
    id: `db_${id}`,
    status: "validated",
    databaseProvider: "postgres-pgvector",
    schemaName: `agent_${id}`,
    sqlMigration: "create extension if not exists vector;",
    statements: [],
    tables: [],
    indexes: [],
    vectorization: {
      embeddingProvider: "voyage",
      embeddingModel: "voyage-4-large",
      dimensions: 1024,
      sourceFields: ["knowledge_chunks.content"],
      metadataFields: ["document_id"],
      retrievalMode: "hybrid",
      chunking: {
        method: "semantic",
        targetTokens: 420,
        overlapTokens: 72,
      },
      index: {
        kind: "hnsw",
        metric: "cosine",
      },
    },
    kg: {
      enabled: false,
      entityTypes: [],
      relationTypes: [],
    },
    repositories: {
      repositories: [],
      safetyRules: [],
    },
    reasons: [],
    risks: [],
  };
}

function successfulWorkflow() {
  return {
    async learnFromSession() {
      return {
        status: "applied" as const,
        memoryCount: 1,
        graphNodeCount: 1,
        graphEdgeCount: 1,
        evolution: {
          status: "applied" as const,
          draftId: "draft-agent-a",
          version: 2,
          reason: "BDD success",
        },
      };
    },
  };
}

function failingWorkflow() {
  return {
    async learnFromSession() {
      throw new Error("intentional bdd failure");
    },
  };
}

function runTemporalScenario(
  workflow: LearnFromSessionWorkflow,
  input: LearningSessionInput,
) {
  return new Promise<{
    terminal: LearningJobStatus;
    statuses: string[];
  }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Temporal BDD status timeout"));
      }, 5_000);
      const statuses: string[] = [];
      const temporal = new LocalTemporalWorkflowPort({
        workflow,
        onStatus: (status) => {
          statuses.push(status.status);
          if (status.status === "applied" || status.status === "failed" || status.status === "skipped") {
            clearTimeout(timeout);
            resolve({ terminal: status, statuses });
          }
        },
      });
      temporal.enqueueLearningSession(input);
    },
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
