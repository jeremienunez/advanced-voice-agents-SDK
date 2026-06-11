import type {
  AgentBuildDraft,
  AgentInfraPlan,
  DatabaseBuildPlan,
  KnowledgeBuildPlan,
} from "@voiceagentsdk/core/sdk";
import { PlannedInfraProvisioner } from "../../../server/builder/adapters/infra/planned-provisioner.js";
import { IntentInfraPlanner } from "../../../server/builder/domain/infra/planner.js";
import { PlanOnlyInfraIacGenerator } from "../../../server/builder/domain/infra/iac-generator.js";

const results = [
  testDefaultPostgresPlan(),
  testExplicitMilvusPlan(),
  testGraphPlan(),
  testRedisPlan(),
  testLearningStorePlan(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function testDefaultPostgresPlan() {
  const plan = new IntentInfraPlanner({
    databaseUrl: "postgres://local/test",
  }).createInfraPlan({
    draft: draft("default", "Concise support agent"),
    databasePlan: databasePlan("default"),
  });

  assert(plan.computeTarget === "local", "default compute should be local");
  assert(plan.isolation === "namespace", "default isolation should be namespace");
  assert(
    plan.provisioningMode === "server_template",
    "default provisioning should be server_template",
  );
  assert(plan.defaultBackendId === "postgres-primary", "Postgres should be default");
  assert(plan.database.configured, "Postgres should be configured");
  assert(plan.knowledgeBackends.length === 1, "Only Postgres should be planned");
  assert(!plan.migrationPolicy.allowGeneratedSql, "Generated SQL must stay disabled");
  assertInfraValid(plan, "default Postgres plan should validate");

  return summary("default-postgres", plan);
}

function testExplicitMilvusPlan() {
  const plan = new IntentInfraPlanner({
    computeTarget: "k3s",
    databaseUrl: "postgres://local/test",
    defaultVectorBackend: "milvus",
    isolation: "namespace",
    milvusUrl: "http://milvus:19530",
    provisioningMode: "iac_plan",
  }).createInfraPlan({
    draft: draft("milvus", "Route a high volume RAG corpus with vector search"),
    databasePlan: databasePlan("milvus"),
  });
  const milvus = requiredBackend(plan, "milvus-vector");

  assert(plan.computeTarget === "k3s", "k3s compute should be normalized");
  assert(plan.defaultBackendId === "milvus-vector", "Milvus should be default");
  assert(milvus.configured, "Milvus should be configured when URL exists");
  assert(milvus.required, "Explicit Milvus selection should be required");
  assert(plan.migrationPolicy.source === "iac_module", "IaC mode should be exposed");
  assert(plan.security.networkPolicy === "private_network", "k3s should use private network");
  assertInfraValid(plan, "explicit Milvus plan should validate");
  assertIacBundle(plan, "k3s/namespace.yaml", "k3s/agent.auto.tfvars.json");

  return summary("explicit-milvus", plan);
}

function testGraphPlan() {
  const plan = new IntentInfraPlanner({
    databaseUrl: "postgres://local/test",
  }).createInfraPlan({
    draft: draft("graph", "Explain entity relationships across policies"),
    databasePlan: databasePlan("graph"),
    knowledgePlan: knowledgePlan("hybrid_kg", true),
  });
  const graph = requiredBackend(plan, "graph-index");

  assert(graph.provider === "graph", "Graph backend should be planned");
  assert(!graph.configured, "Graph backend should be optional without URL");
  assert(!graph.required, "Graph backend should not block the Postgres fallback");
  assert(
    plan.warnings?.some((warning) => warning.includes("Knowledge graph")),
    "Missing graph URL should produce a KG warning",
  );
  assertInfraValid(plan, "graph fallback plan should validate");

  return summary("graph", plan);
}

function testRedisPlan() {
  const plan = new IntentInfraPlanner({
    databaseUrl: "postgres://local/test",
    redisUrl: "redis://localhost:6379",
  }).createInfraPlan({
    draft: draft("redis", "Use low latency stateful session cache"),
    databasePlan: databasePlan("redis"),
  });
  const redis = requiredBackend(plan, "redis-cache");

  assert(redis.provider === "redis", "Redis backend should be planned");
  assert(redis.configured, "Redis should be configured when URL exists");
  assert(redis.capabilities.includes("cache"), "Redis backend should expose cache");
  assertInfraValid(plan, "Redis plan should validate");
  assertIacBundle(plan, "local/README.txt", "agent-infra.plan.json");

  return summary("redis", plan);
}

function testLearningStorePlan() {
  const plan = new IntentInfraPlanner({
    databaseUrl: "postgres://local/test",
    learningEnabled: true,
    redisUrl: "redis://localhost:6379",
    temporalAddress: "localhost:7233",
    temporalNamespace: "default",
    temporalTaskQueue: "agent-learning",
  }).createInfraPlan({
    draft: draft("learning", "Self-improve after RTC sessions"),
    databasePlan: databasePlan("learning"),
  });

  assert(plan.storePlan?.enabled, "Learning store plan should be enabled");
  assert(
    plan.storePlan.temporalWorkflow.provider === "temporal",
    "Temporal workflow store should be planned",
  );
  assert(
    plan.storePlan.temporalMemory.provider === "redis",
    "Redis temporal memory should be planned",
  );
  assert(
    plan.storePlan.graphMemory.kind === "graph_memory",
    "Graph memory store should be planned",
  );
  assert(
    plan.storePlan.guardrails.appendOnlyVersions,
    "Learning versions must be append-only",
  );
  assertInfraValid(plan, "learning store plan should validate");

  return summary("learning-stores", plan);
}

function draft(id: string, intent: string): AgentBuildDraft {
  return {
    id: `draft_${id}`,
    status: "draft",
    identity: {
      builderFirstName: "Test",
      builderLastName: "Builder",
      publicAgentName: `Infra ${id}`,
      intent,
      mustDo: [],
      mustNotDo: [],
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
    schemaName: `agent_draft_${id}`,
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

function knowledgePlan(
  strategy: KnowledgeBuildPlan["strategy"],
  kgEnabled: boolean,
): KnowledgeBuildPlan {
  return {
    strategy,
    alternativeStrategies: [],
    documents: [],
    chunking: {
      method: "semantic",
      targetTokens: 420,
      overlapTokens: 72,
    },
    indexes: [],
    kg: {
      enabled: kgEnabled,
      entityTypes: ["policy"],
      relationTypes: ["depends_on"],
    },
    reasons: [],
    validationRequired: false,
  };
}

function requiredBackend(plan: ReturnType<IntentInfraPlanner["createInfraPlan"]>, id: string) {
  const backend = plan.knowledgeBackends.find((item) => item.id === id);
  assert(backend, `Missing backend: ${id}`);
  return backend;
}

function assertInfraValid(plan: AgentInfraPlan, message: string): void {
  const provisioner = new PlannedInfraProvisioner();
  const validation = provisioner.validate({
    draft: draft(plan.draftId.replace(/^draft_/, ""), "validation"),
    plan,
  });
  assert(validation.ok, `${message}: ${validation.errors.join("; ")}`);
}

function assertIacBundle(
  plan: AgentInfraPlan,
  firstPath: string,
  secondPath: string,
): void {
  const bundle = new PlanOnlyInfraIacGenerator().createBundle(plan);
  const paths = bundle.artifacts.map((artifact) => artifact.path);
  assert(paths.includes(firstPath), `IaC bundle missing ${firstPath}`);
  assert(paths.includes(secondPath), `IaC bundle missing ${secondPath}`);
  assert(
    bundle.artifacts.every((artifact) => !artifact.sensitive),
    "IaC artifacts must not contain secret values",
  );
}

function summary(
  name: string,
  plan: ReturnType<IntentInfraPlanner["createInfraPlan"]>,
) {
  return {
    name,
    defaultBackendId: plan.defaultBackendId,
    computeTarget: plan.computeTarget,
    isolation: plan.isolation,
    provisioningMode: plan.provisioningMode,
    backends: plan.knowledgeBackends.map((backend) => ({
      id: backend.id,
      provider: backend.provider,
      configured: backend.configured,
      required: backend.required,
    })),
    learningStores: plan.storePlan
      ? [
          plan.storePlan.temporalWorkflow.provider,
          plan.storePlan.temporalMemory.provider,
          plan.storePlan.graphMemory.provider,
          plan.storePlan.auditStore.provider,
        ]
      : [],
    warningCount: plan.warnings?.length ?? 0,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
