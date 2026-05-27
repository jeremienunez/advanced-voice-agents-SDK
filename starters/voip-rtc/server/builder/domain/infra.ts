import type {
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
  normalizeComputeTarget,
  normalizeIsolation,
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

    const defaultBackendId = this.resolveDefaultBackendId(
      knowledgeBackends,
      explicitMilvus,
      wantsVectorScale,
    );
    const secretRefs = uniqueList(
      knowledgeBackends.flatMap((backend) => backend.requiredEnv ?? []),
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
      reasons,
      warnings,
      raw: {
        backendCount: knowledgeBackends.length,
        vectorScaleIntent: wantsVectorScale,
        graphIntent: wantsGraph,
        cacheIntent: wantsCache,
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
