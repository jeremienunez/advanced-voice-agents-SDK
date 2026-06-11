import type {
  AgentBuildDraft,
  AgentInfraPlan,
  CompiledAgentArtifact,
  DatabaseBuildPlan,
  RuntimeDatabaseCredentialRef,
} from "@voiceagentsdk/core/sdk";
import { IntentInfraPlanner } from "../../../server/builder/domain/infra/planner.js";
import { PlanOnlyInfraIacGenerator } from "../../../server/builder/domain/infra/iac-generator.js";
import { resolvePostgresKnowledgeDatabaseUrl } from "../../../server/adapters/postgres/knowledge-credentials.js";
import { runtimeAgentFromDraft } from "../../../server/runtime/compiled-agent.js";
import { assert } from "../shared/assertions.js";

const results = [
  scenarioInfraPlanCreatesPerAgentCredentialRef(),
  scenarioRuntimeScopeCarriesCredentialRef(),
  await scenarioRuntimeSearchUsesAgentCredentialRef(),
  scenarioIacCarriesCredentialRefOnly(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioInfraPlanCreatesPerAgentCredentialRef(): string {
  const plan = infraPlan();
  const ref = requiredRef(plan);

  assert(ref.scope === "agent", "runtime database credential must be agent scoped");
  assert(ref.provider === "postgres-pgvector", "runtime credential must target Postgres");
  assert(ref.schemaName === plan.database.schemaName, "credential ref must bind schema");
  assert(ref.roleName === `${plan.database.schemaName}_rt`, "credential ref must bind runtime role");
  assert(ref.envName !== "DATABASE_URL", "runtime credential must not reuse shared DATABASE_URL");
  assert(
    ref.envName.startsWith("AGENT_DB_RUNTIME_URL_"),
    "runtime credential must be addressable through a per-agent dev env name",
  );
  assert(
    plan.security.secretRefs.includes(ref.envName),
    "per-agent runtime credential env must be declared as a secret ref",
  );

  return "infra-plan-per-agent-runtime-db-ref";
}

function scenarioRuntimeScopeCarriesCredentialRef(): string {
  const plan = infraPlan();
  const ref = requiredRef(plan);
  const agent = runtimeAgentFromDraft({
    ...draft(),
    databasePlan: databasePlan(),
    infraPlan: plan,
    compiled: compiledArtifact(),
  });

  assert(agent, "compiled runtime agent must be created");
  assert(
    agent.knowledgeScope.databaseCredentialRef?.envName === ref.envName,
    "runtime knowledge scope must carry the per-agent database credential ref",
  );

  return "runtime-scope-carries-db-ref";
}

async function scenarioRuntimeSearchUsesAgentCredentialRef(): Promise<string> {
  const ref = requiredRef(infraPlan());
  const resolved = await resolvePostgresKnowledgeDatabaseUrl({
    fallbackDatabaseUrl: "postgres://shared-admin/dev",
    scope: { draftId: "draft_runtime_db", schemaName: ref.schemaName, databaseCredentialRef: ref },
    credentialResolver: {
      resolveDatabaseUrl: (input) =>
        input.envName === ref.envName ? "postgres://agent-runtime/dev" : undefined,
    },
  });
  const missing = await resolvePostgresKnowledgeDatabaseUrl({
    fallbackDatabaseUrl: "postgres://shared-admin/dev",
    scope: { draftId: "draft_runtime_db", schemaName: ref.schemaName, databaseCredentialRef: ref },
    credentialResolver: { resolveDatabaseUrl: () => undefined },
  });

  assert(
    resolved === "postgres://agent-runtime/dev",
    "runtime search must resolve the per-agent credential ref",
  );
  assert(
    missing === undefined,
    "runtime search must not fall back to shared DATABASE_URL when an agent ref exists",
  );

  return "runtime-search-uses-agent-db-ref";
}

function scenarioIacCarriesCredentialRefOnly(): string {
  const plan = infraPlan();
  const ref = requiredRef(plan);
  const bundle = new PlanOnlyInfraIacGenerator().createBundle(plan);
  const serialized = JSON.stringify(bundle);

  assert(serialized.includes(ref.envName), "IaC bundle must carry the credential ref");
  assert(
    !serialized.includes("postgres://provisioning/dev"),
    "IaC bundle must not carry the provisioning database URL",
  );

  return "iac-carries-db-ref-not-url";
}

function infraPlan(): AgentInfraPlan {
  return new IntentInfraPlanner({
    databaseUrl: "postgres://provisioning/dev",
  }).createInfraPlan({
    draft: draft(),
    databasePlan: databasePlan(),
  });
}

function requiredRef(plan: AgentInfraPlan): RuntimeDatabaseCredentialRef {
  const ref = plan.database.runtimeCredentialRef;
  assert(ref, "Postgres database backend must expose a runtime credential ref");
  return ref;
}

function draft(): AgentBuildDraft {
  const now = new Date(0).toISOString();
  return {
    id: "draft_runtime_db",
    status: "draft",
    identity: {
      builderFirstName: "Runtime",
      builderLastName: "Db",
      publicAgentName: "Runtime DB Agent",
      intent: "Validate per-agent runtime database credentials",
      mustDo: [],
      mustNotDo: [],
    },
    toolRegistry: [],
    selectedTools: ["search_knowledge"],
    promptParts: {},
    createdAt: now,
    updatedAt: now,
  };
}

function databasePlan(): DatabaseBuildPlan {
  return {
    id: "db_runtime_db",
    status: "validated",
    databaseProvider: "postgres-pgvector",
    schemaName: "agent_runtime_db",
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
      chunking: { method: "semantic", targetTokens: 420, overlapTokens: 72 },
      index: { kind: "hnsw", metric: "cosine" },
    },
    kg: { enabled: false, entityTypes: [], relationTypes: [] },
    repositories: { repositories: [], safetyRules: [] },
    reasons: [],
    risks: [],
  };
}

function compiledArtifact(): CompiledAgentArtifact {
  return {
    draftId: "draft_runtime_db",
    sdkDefinition: {
      tenants: [],
      providers: [],
      mediaBridges: [],
      plans: [],
      prompts: [],
      tools: [],
      databases: [],
      stores: [],
      onboarding: [],
      packs: [],
    },
    prompt: "Use search_knowledge.",
    toolRegistry: [],
    selectedTools: ["search_knowledge"],
    knowledge: {
      strategy: "hybrid_kg",
      storeId: "postgres-pgvector:agent_runtime_db",
      documentCount: 1,
      chunkCount: 1,
      status: "compiled",
    },
    createdAt: new Date(0).toISOString(),
  };
}
