import type {
  AgentStorePlan,
  AgentInfraPlan,
  DatabaseBackendPlan,
  InfraIsolationMode,
  InfraPlanRequest,
  InfraPlannerPort,
  InfraProvisioningMode,
  InfraResourceRef,
  KnowledgeBackendPlan,
} from "@voiceagentsdk/core/sdk";
import {
  cacheTerms,
  graphTerms,
  hasAny,
  isMilvusRequested,
  type IntentInfraPlannerOptions,
  normalizeBoolean,
  normalizeComputeTarget,
  normalizeIsolation,
  normalizePositiveInteger,
  normalizeProvisioningMode,
  searchableIntent,
  uniqueList,
  vectorScaleTerms,
} from "./infra-routing.js";
import { agentSchemaName } from "./sql.js";

export class IntentInfraPlanner implements InfraPlannerPort {
  constructor(private readonly options: IntentInfraPlannerOptions = {}) {}

  createInfraPlan(input: InfraPlanRequest): AgentInfraPlan {
    const computeTarget = normalizeComputeTarget(this.options.computeTarget);
    const isolation = normalizeIsolation(this.options.isolation);
    const provisioningMode = normalizeProvisioningMode(
      this.options.provisioningMode,
    );
    const schemaName = input.databasePlan?.schemaName ?? agentSchemaName(input.draft.id);
    const intent = searchableIntent(input);
    const wantsVectorScale = hasAny(intent, vectorScaleTerms);
    const wantsGraph = Boolean(input.knowledgePlan?.kg.enabled) ||
      hasAny(intent, graphTerms) ||
      Boolean(this.options.graphUrl);
    const wantsCache = hasAny(intent, cacheTerms) || Boolean(this.options.redisUrl);
    const learningEnabled = normalizeBoolean(this.options.learningEnabled);
    const explicitMilvus = isMilvusRequested(this.options.defaultVectorBackend);
    const includeMilvus = explicitMilvus ||
      wantsVectorScale ||
      Boolean(this.options.milvusUrl);
    const database = this.createDatabaseBackend(
      schemaName,
      isolation,
      provisioningMode,
    );
    const resources: InfraResourceRef[] = [
      {
        kind: "postgres-schema",
        name: schemaName,
        provider: "postgres-pgvector",
        namespace: schemaName,
      },
    ];
    const knowledgeBackends: KnowledgeBackendPlan[] = [
      this.createPostgresKnowledgeBackend(schemaName, isolation, provisioningMode),
    ];
    const warnings: string[] = [];
    const reasons: string[] = [
      "Postgres remains the source of truth so every agent has a durable SQL store.",
      `Intent analysis selected ${computeTarget} compute with ${isolation} isolation.`,
    ];

    if (!this.options.databaseUrl) {
      warnings.push("DATABASE_URL is missing; the Postgres backend is planned only.");
    }

    if (includeMilvus) {
      knowledgeBackends.push(
        this.createMilvusBackend(schemaName, isolation, provisioningMode, explicitMilvus),
      );
      resources.push({
        kind: "vector-collection",
        name: `${schemaName}_vectors`,
        provider: "milvus",
        namespace: schemaName,
      });
      reasons.push("Vector-heavy intent can be routed to a dedicated Milvus index.");
      if (!this.options.milvusUrl && explicitMilvus) {
        warnings.push("BUILDER_VECTOR_BACKEND requests Milvus but MILVUS_URL is missing.");
      } else if (!this.options.milvusUrl && wantsVectorScale) {
        warnings.push("Milvus is recommended by intent, but MILVUS_URL is not configured.");
      }
    }

    if (wantsGraph) {
      knowledgeBackends.push(
        this.createGraphBackend(schemaName, isolation, provisioningMode),
      );
      resources.push({
        kind: "graph-space",
        name: `${schemaName}_graph`,
        provider: "graph",
        namespace: schemaName,
      });
      reasons.push("Graph/RAG intent gets a graph-index slot without forcing the SDK to a vendor.");
      if (!this.options.graphUrl && input.knowledgePlan?.kg.enabled) {
        warnings.push("Knowledge graph is requested; using the Postgres KG plan until a graph backend is configured.");
      }
    }

    if (wantsCache) {
      knowledgeBackends.push(
        this.createRedisBackend(schemaName, isolation, provisioningMode),
      );
      resources.push({
        kind: "cache-namespace",
        name: `${schemaName}_cache`,
        provider: "redis",
        namespace: schemaName,
      });
      reasons.push("Session/cache intent gets a Redis slot that can be provisioned later.");
      if (!this.options.redisUrl) {
        warnings.push("Redis cache is suggested by intent, but REDIS_URL is not configured.");
      }
    }

    const storePlan = learningEnabled
      ? this.createStorePlan(schemaName, isolation, provisioningMode)
      : undefined;
    if (storePlan) {
      resources.push(
        ...storePlanResources(storePlan),
      );
      reasons.push("Post-session learning stores are planned now and created only when learning runs.");
      if (storePlan.warnings?.length) warnings.push(...storePlan.warnings);
    }

    const defaultBackendId = this.resolveDefaultBackendId(
      knowledgeBackends,
      explicitMilvus,
      wantsVectorScale,
    );
    const secretRefs = uniqueList(
      [
        ...knowledgeBackends.flatMap((backend) => backend.requiredEnv ?? []),
        ...(storePlan ? storePlanEnvRefs(storePlan) : []),
      ],
    );

    return {
      id: `infra_plan_${input.draft.id}`,
      draftId: input.draft.id,
      status: "planned",
      computeTarget,
      isolation,
      provisioningMode,
      defaultBackendId,
      database,
      knowledgeBackends,
      resources,
      migrationPolicy: {
        source: provisioningMode === "iac_plan" ? "iac_module" : "server_owned_templates",
        allowGeneratedSql: false,
        requiresApproval: provisioningMode === "manual" ||
          provisioningMode === "external",
        versionTable: `${schemaName}.agent_schema_migrations`,
        notes: [
          "Generated SQL is only planning material; executable migrations stay server-owned.",
          "Future IaC modules can consume this plan without changing SDK agent definitions.",
        ],
      },
      security: {
        tenantScoped: true,
        leastPrivilegeRole: false,
        secretRefs,
        networkPolicy: computeTarget === "local" ? "local_only" : "private_network",
        notes: [
          "Least-privileged database roles are not automated in this starter slice yet.",
          "Application auth must still protect builder and voice control-plane routes.",
        ],
      },
      storePlan,
      reasons,
      warnings,
      raw: {
        backendCount: knowledgeBackends.length,
        vectorScaleIntent: wantsVectorScale,
        graphIntent: wantsGraph,
        cacheIntent: wantsCache,
        learningEnabled,
      },
    };
  }

  private createDatabaseBackend(
    schemaName: string,
    isolation: InfraIsolationMode,
    provisioningMode: InfraProvisioningMode,
  ): DatabaseBackendPlan {
    return {
      id: "postgres-primary",
      provider: "postgres-pgvector",
      configured: Boolean(this.options.databaseUrl),
      namespace: schemaName,
      schemaName,
      provisioningMode,
      isolation,
      reason: "Durable source-of-truth store for agent knowledge, metadata, and pgvector fallback.",
      requiredEnv: ["DATABASE_URL"],
      resources: [
        {
          kind: "postgres-schema",
          name: schemaName,
          provider: "postgres-pgvector",
          namespace: schemaName,
        },
      ],
    };
  }

  private createPostgresKnowledgeBackend(
    schemaName: string,
    isolation: InfraIsolationMode,
    provisioningMode: InfraProvisioningMode,
  ): KnowledgeBackendPlan {
    return {
      id: "postgres-primary",
      provider: "postgres-pgvector",
      role: "source_of_truth",
      configured: Boolean(this.options.databaseUrl),
      namespace: schemaName,
      required: true,
      capabilities: [
        "sql",
        "lexical_search",
        "vector_search",
        "hybrid_search",
        "metadata_filter",
      ],
      provisioningMode,
      isolation,
      reason: "Default backend for source documents, chunks, lexical search, and pgvector retrieval.",
      requiredEnv: ["DATABASE_URL"],
    };
  }

  private createMilvusBackend(
    schemaName: string,
    isolation: InfraIsolationMode,
    provisioningMode: InfraProvisioningMode,
    required: boolean,
  ): KnowledgeBackendPlan {
    return {
      id: "milvus-vector",
      provider: "milvus",
      role: "vector_index",
      configured: Boolean(this.options.milvusUrl),
      namespace: `${schemaName}_vectors`,
      required,
      capabilities: ["vector_search", "metadata_filter"],
      provisioningMode,
      isolation,
      reason: "Dedicated vector index for larger corpora or explicit Milvus routing.",
      requiredEnv: ["MILVUS_URL", "MILVUS_ADDRESS"],
    };
  }

  private createGraphBackend(
    schemaName: string,
    isolation: InfraIsolationMode,
    provisioningMode: InfraProvisioningMode,
  ): KnowledgeBackendPlan {
    return {
      id: "graph-index",
      provider: "graph",
      role: "graph_index",
      configured: Boolean(this.options.graphUrl),
      namespace: `${schemaName}_graph`,
      required: false,
      capabilities: ["graph_search", "metadata_filter"],
      provisioningMode,
      isolation,
      reason: "Optional graph index for entity and relationship traversal.",
      requiredEnv: ["NEO4J_URI", "GRAPH_DATABASE_URL"],
    };
  }

  private createRedisBackend(
    schemaName: string,
    isolation: InfraIsolationMode,
    provisioningMode: InfraProvisioningMode,
  ): KnowledgeBackendPlan {
    return {
      id: "redis-cache",
      provider: "redis",
      role: "cache",
      configured: Boolean(this.options.redisUrl),
      namespace: `${schemaName}_cache`,
      required: false,
      capabilities: ["cache"],
      provisioningMode,
      isolation,
      reason: "Optional cache namespace for sessions, hot retrieval results, or orchestration state.",
      requiredEnv: ["REDIS_URL"],
    };
  }

  private createStorePlan(
    schemaName: string,
    isolation: InfraIsolationMode,
    provisioningMode: InfraProvisioningMode,
  ): AgentStorePlan {
    const ttlSeconds = normalizePositiveInteger(
      this.options.learningMemoryTtlSeconds,
      60 * 60 * 24 * 30,
    );
    const namespace = `${schemaName}_learning`;
    const temporalAddress = this.options.temporalAddress;
    const temporalConfigured = Boolean(
      temporalAddress || this.options.temporalNamespace || this.options.temporalTaskQueue,
    );
    const graphConfigured = Boolean(this.options.graphUrl || this.options.databaseUrl);
    const warnings: string[] = [];

    if (!this.options.redisUrl) {
      warnings.push("Learning temporal memory is enabled; REDIS_URL is required for the Redis memory store.");
    }
    if (!temporalConfigured) {
      warnings.push("Learning workflow is enabled; TEMPORAL_ADDRESS or a local Temporal worker must be configured.");
    }
    if (!this.options.databaseUrl) {
      warnings.push("Learning audit/source store is enabled; DATABASE_URL is required for durable version audit.");
    }

    return {
      enabled: true,
      scopes: ["agent", "user"],
      createOn: "session_end",
      temporalWorkflow: {
        id: "temporal-learning-workflow",
        kind: "temporal_workflow",
        provider: "temporal",
        configured: temporalConfigured,
        required: true,
        namespace: this.options.temporalNamespace ?? "default",
        provisioningMode,
        isolation,
        createOn: "session_end",
        capabilities: ["workflow_queue"],
        reason: "Runs learnFromSession after RTC shutdown without blocking the user.",
        requiredEnv: ["TEMPORAL_ADDRESS", "TEMPORAL_NAMESPACE", "TEMPORAL_TASK_QUEUE"],
        resources: [
          {
            kind: "temporal-task-queue",
            name: this.options.temporalTaskQueue ?? "agent-learning",
            provider: "temporal",
            namespace: this.options.temporalNamespace ?? "default",
          },
        ],
      },
      temporalMemory: {
        id: "redis-temporal-memory",
        kind: "temporal_memory",
        provider: "redis",
        configured: Boolean(this.options.redisUrl),
        required: true,
        namespace,
        provisioningMode,
        isolation,
        createOn: "session_end",
        capabilities: ["session_window", "ttl", "fact_memory", "preference_memory"],
        reason: "Stores short-lived facts, preferences, failed intents, and missing tool signals with tenant/user scope.",
        requiredEnv: ["REDIS_URL"],
        ttlSeconds,
        resources: [
          {
            kind: "redis-namespace",
            name: namespace,
            provider: "redis",
            namespace,
          },
        ],
      },
      graphMemory: {
        id: "graph-memory",
        kind: "graph_memory",
        provider: this.options.graphUrl ? "graph" : "postgres",
        configured: graphConfigured,
        required: false,
        namespace: `${namespace}_graph`,
        provisioningMode,
        isolation,
        createOn: "session_end",
        capabilities: ["entity_graph", "relation_graph"],
        reason: "Upserts session entities and relations through a pluggable graph adapter; Postgres is the local default.",
        requiredEnv: ["DATABASE_URL", "NEO4J_URI", "GRAPH_DATABASE_URL"],
        resources: [
          {
            kind: "graph-memory-space",
            name: `${namespace}_graph`,
            provider: this.options.graphUrl ? "graph" : "postgres",
            namespace,
          },
        ],
      },
      auditStore: {
        id: "learning-audit-source",
        kind: "audit_source",
        provider: "postgres",
        configured: Boolean(this.options.databaseUrl),
        required: true,
        namespace,
        provisioningMode,
        isolation,
        createOn: "session_end",
        capabilities: ["audit_log", "source_archive"],
        reason: "Records every automatic prompt/tool/infra evolution and rollback pointer append-only.",
        requiredEnv: ["DATABASE_URL"],
        resources: [
          {
            kind: "agent-version-audit",
            name: `${namespace}_agent_versions`,
            provider: "postgres",
            namespace,
          },
        ],
      },
      vectorBackend: isMilvusRequested(this.options.defaultVectorBackend)
        ? {
            id: "learning-vector-memory",
            kind: "vector_memory",
            provider: "milvus",
            configured: Boolean(this.options.milvusUrl),
            required: false,
            namespace: `${namespace}_vectors`,
            provisioningMode,
            isolation,
            createOn: "session_end",
            capabilities: ["vector_search"],
            reason: "Optional vector slot for long-horizon learned memory retrieval.",
            requiredEnv: ["MILVUS_URL", "MILVUS_ADDRESS"],
          }
        : undefined,
      guardrails: {
        appendOnlyVersions: true,
        rollbackPointer: true,
        auditEveryChange: true,
        redactSecrets: true,
        destructiveInfraMigrations: "forbidden",
      },
      reasons: [
        "Learning is queued after session end so RTC shutdown stays responsive.",
        "Global agent memory and user personalization are both scoped explicitly.",
        "Stores are described in the infra plan but ensured only by the learning workflow.",
      ],
      warnings,
    };
  }

  private resolveDefaultBackendId(
    backends: KnowledgeBackendPlan[],
    explicitMilvus: boolean,
    wantsVectorScale: boolean,
  ): string {
    const milvus = backends.find((backend) => backend.id === "milvus-vector");
    if (explicitMilvus && milvus) return milvus.id;
    if (wantsVectorScale && milvus?.configured) return milvus.id;
    return "postgres-primary";
  }
}

function storePlanEnvRefs(plan: AgentStorePlan): string[] {
  return uniqueList(
    [
      plan.temporalWorkflow,
      plan.temporalMemory,
      plan.graphMemory,
      plan.auditStore,
      plan.vectorBackend,
    ].flatMap((backend) => backend?.requiredEnv ?? []),
  );
}

function storePlanResources(plan: AgentStorePlan): InfraResourceRef[] {
  return [
    plan.temporalWorkflow,
    plan.temporalMemory,
    plan.graphMemory,
    plan.auditStore,
    plan.vectorBackend,
  ].flatMap((backend) => backend?.resources ?? []);
}
