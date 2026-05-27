import type {
  AgentInfraPlan,
  InfraPlanRequest,
  InfraPlannerPort,
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
  normalizeProvisioningMode,
  searchableIntent,
  uniqueList,
  vectorScaleTerms,
} from "./infra-routing.js";
import {
  createDatabaseBackend,
  createGraphBackend,
  createMilvusBackend,
  createPostgresKnowledgeBackend,
  createRedisBackend,
  resolveDefaultBackendId,
} from "./infra-backends.js";
import {
  createAgentStorePlan,
  storePlanEnvRefs,
  storePlanResources,
} from "./infra-learning.js";
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
    const backendInput = {
      options: this.options,
      schemaName,
      isolation,
      provisioningMode,
    };
    const database = createDatabaseBackend(backendInput);
    const resources: InfraResourceRef[] = [
      {
        kind: "postgres-schema",
        name: schemaName,
        provider: "postgres-pgvector",
        namespace: schemaName,
      },
    ];
    const knowledgeBackends: KnowledgeBackendPlan[] = [
      createPostgresKnowledgeBackend(backendInput),
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
        createMilvusBackend(backendInput, explicitMilvus),
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
        createGraphBackend(backendInput),
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
        createRedisBackend(backendInput),
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
      ? createAgentStorePlan({
          options: this.options,
          schemaName,
          isolation,
          provisioningMode,
        })
      : undefined;
    if (storePlan) {
      resources.push(
        ...storePlanResources(storePlan),
      );
      reasons.push("Post-session learning stores are planned now and created only when learning runs.");
      if (storePlan.warnings?.length) warnings.push(...storePlan.warnings);
    }

    const defaultBackendId = resolveDefaultBackendId(
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
        leastPrivilegeRole: true,
        secretRefs,
        networkPolicy: computeTarget === "local" ? "local_only" : "private_network",
        notes: [
          "Server-owned Postgres templates create a no-login per-agent runtime role.",
          "Runtime role grants stay read-only and carry a statement_timeout.",
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
}
