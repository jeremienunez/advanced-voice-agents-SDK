import { LocalGraphMemoryStore } from "../../../../server/learning/graph-store.js";
import { LocalRedisTemporalMemoryStore } from "../../../../server/learning/memory-store.js";
import { LearnFromSessionWorkflow } from "../../../../server/learning/workflow.js";
import { assert, scenario, type ScenarioResult } from "./assert.js";
import { infraPlan, learningSession } from "./fixtures.js";
import { RecordingEvolution } from "./recording-evolution.js";
import {
  failingWorkflow,
  runTemporalScenario,
  successfulWorkflow,
} from "./temporal.js";

export async function runLearningBddScenarios(): Promise<ScenarioResult[]> {
  return [
    await scenario("Given learning is enabled in dev infra, when the planner runs, then it exposes every required store without provisioning them upfront", learningInfraScenario),
    await scenario("Given a Temporal learning queue, when jobs apply or fail, then status progression is observable and failures stay async", temporalScenario),
    await scenario("Given a completed RTC session, when learning runs, then memory, graph and version evolution become observable", appliedLearningScenario),
    await scenario("Given a session without an agent or draft id, when learning runs, then it is skipped and produces no side effects", skippedLearningScenario),
  ];
}

async function learningInfraScenario(): Promise<string[]> {
  const plan = infraPlan({ learningEnabled: true, configured: true });
  const disabled = infraPlan({ learningEnabled: false, configured: true });
  const missingConfig = infraPlan({ learningEnabled: true, configured: false });

  assert(plan.storePlan?.enabled, "learning store plan must be present when learning is enabled");
  assert(plan.storePlan.createOn === "session_end", "stores must be created only at session end");
  assert(plan.storePlan.temporalWorkflow.provider === "temporal", "Temporal workflow store must be planned");
  assert(plan.storePlan.temporalMemory.provider === "redis", "Redis temporal memory store must be planned");
  assert(plan.storePlan.graphMemory.kind === "graph_memory", "graph memory store must be planned");
  assert(plan.storePlan.auditStore.kind === "audit_source", "audit/source store must be planned");
  assert(plan.storePlan.guardrails.appendOnlyVersions, "append-only version guardrail must be explicit");
  assert(plan.storePlan.guardrails.rollbackPointer, "rollback pointer guardrail must be explicit");
  assert(plan.storePlan.guardrails.redactSecrets, "secret redaction guardrail must be explicit");
  assert(plan.security.secretRefs.includes("REDIS_URL"), "REDIS_URL must be in secret refs");
  assert(plan.security.secretRefs.includes("TEMPORAL_ADDRESS"), "TEMPORAL_ADDRESS must be in secret refs");
  assert(plan.security.secretRefs.includes("DATABASE_URL"), "DATABASE_URL must be in secret refs");
  assert(!disabled.storePlan, "learning store plan must disappear when learning is disabled");
  assert(warningsInclude(missingConfig.warnings, "REDIS_URL"), "missing Redis must warn");
  assert(warningsInclude(missingConfig.warnings, "TEMPORAL_ADDRESS"), "missing Temporal must warn");
  assert(warningsInclude(missingConfig.warnings, "DATABASE_URL"), "missing Postgres must warn");

  return [
    "planned Temporal, Redis, graph and audit stores",
    "kept createOn=session_end instead of eager provisioning",
    "exposed append-only, rollback and redaction guardrails",
    "disabled store plan when learning is disabled",
    "surfaced missing env as warnings",
  ];
}

async function temporalScenario(): Promise<string[]> {
  const appliedRun = await runTemporalScenario(
    successfulWorkflow(),
    learningSession({
      transcriptText: "I prefer concise answers for Acme Routes.",
      toolStatus: "completed",
    }),
  );
  assert(appliedRun.terminal.status === "applied", "successful Temporal job must finish applied");
  assert(appliedRun.statuses.join(">") === "queued>running>applied", "successful Temporal status order is wrong");

  const failedRun = await runTemporalScenario(
    failingWorkflow(),
    learningSession({
      runId: "learn-bdd-failure",
      transcriptText: "I prefer concise answers for Acme Routes.",
      toolStatus: "completed",
    }),
  );
  assert(failedRun.terminal.status === "failed", "failing Temporal job must finish failed");
  assert(failedRun.terminal.error?.includes("intentional bdd failure"), "failure status must expose workflow error");
  assert(failedRun.statuses.join(">") === "queued>running>failed", "failed Temporal status order is wrong");

  return [
    "observed queued/running/applied",
    "observed queued/running/failed",
    "converted workflow throw into failed status",
    "kept failure in async learning status path",
  ];
}

async function appliedLearningScenario(): Promise<string[]> {
  const fakeSecret = ["sk", "test", "secret", "value"].join("-");
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
      `I prefer concise answers. My project is Acme Routes. api_key=${fakeSecret}`,
    toolStatus: "failed",
    toolError: "Unknown tool create_invoice",
  });

  const first = await workflow.learnFromSession(input);
  const scopedMemory = await memoryStore.list({
    tenantId: "tenant-a",
    agentId: "draft-agent-a",
    userId: "user-a",
  });
  assertAppliedLearning(first, scopedMemory, evolution, fakeSecret);

  const nodeCount = graphStore.nodeCount;
  const edgeCount = graphStore.edgeCount;
  const second = await workflow.learnFromSession({ ...input, runId: "learn-bdd-session-a-repeat" });
  assert(second.evolution.version === 3, "second learning run must append version 3");
  assert(graphStore.nodeCount === nodeCount, "replay must not duplicate graph nodes");
  assert(graphStore.edgeCount === edgeCount, "replay must not duplicate graph edges");

  return [
    "applied learning for a real draft session",
    "wrote scoped TTL memory with secret redaction",
    "upserted graph memory idempotently",
    "surfaced missing-tool and retrieval-weight recommendations",
    "appended versions 2 and 3 without overwrite",
  ];
}

async function skippedLearningScenario(): Promise<string[]> {
  const memoryStore = new LocalRedisTemporalMemoryStore();
  const graphStore = new LocalGraphMemoryStore();
  const evolution = new RecordingEvolution();
  const workflow = new LearnFromSessionWorkflow({
    memoryStore,
    graphStore,
    evolution,
    memoryTtlSeconds: 60,
  });
  const result = await workflow.learnFromSession(learningSession({
    draftId: null,
    agentId: null,
    transcriptText: "I prefer concise answers for Acme Routes.",
    toolStatus: "completed",
  }));

  assert(result.status === "skipped", "learning must skip sessions without draft");
  assert((await memoryStore.list({ tenantId: "tenant-a" })).length === 0, "skipped learning must not write memory");
  assert(graphStore.nodeCount === 0, "skipped learning must not write graph nodes");
  assert(graphStore.edgeCount === 0, "skipped learning must not write graph edges");
  assert(evolution.calls.length === 0, "skipped learning must not invoke evolution");

  return [
    "skipped orphan session",
    "left memory store empty",
    "left graph store empty",
    "did not invoke evolution",
  ];
}

function assertAppliedLearning(
  result: Awaited<ReturnType<LearnFromSessionWorkflow["learnFromSession"]>>,
  scopedMemory: Awaited<ReturnType<LocalRedisTemporalMemoryStore["list"]>>,
  evolution: RecordingEvolution,
  fakeSecret: string,
) {
  assert(result.status === "applied", "learning must apply for a draft session");
  assert(result.memoryCount >= 4, "learning must write summary, preference, failed intent and missing-tool memory");
  assert(result.graphNodeCount >= 4, "learning must create graph nodes");
  assert(result.graphEdgeCount >= 3, "learning must create graph edges");
  assert(result.evolution.version === 2, "first learning run must append version 2");
  assert(scopedMemory.length === result.memoryCount, "memory must be retrievable by scope");
  assert(scopedMemory.every((record) => record.expiresAt), "every temporal memory must carry TTL expiry");
  assert(scopedMemory.every((record) => !record.text.includes(fakeSecret)), "learned memory must redact secrets");
  assert(evolution.lastInput?.recommendations.tools?.includes("create_invoice"), "missing tool recommendation must be retained");
  assert(typeof evolution.lastInput?.recommendations.retrievalWeights?.temporal === "number", "retrieval weights must be generated");
}

function warningsInclude(
  warnings: string[] | undefined,
  value: string,
): boolean {
  return Boolean(warnings?.some((warning) => warning.includes(value)));
}
