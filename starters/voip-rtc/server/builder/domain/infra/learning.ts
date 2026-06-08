import type {
  AgentLearningStoreBackendPlan,
  AgentStorePlan,
  InfraIsolationMode,
  InfraProvisioningMode,
  InfraResourceRef,
} from "@voiceagentsdk/core/sdk";
import { plannedStarterAdapterBoundary } from "../shared/adapter-boundary.js";
import {
  isMilvusRequested,
  type IntentInfraPlannerOptions,
  normalizePositiveInteger,
  uniqueList,
} from "./routing.js";

export interface LearningStorePlanInput {
  options: IntentInfraPlannerOptions;
  schemaName: string;
  isolation: InfraIsolationMode;
  provisioningMode: InfraProvisioningMode;
}

export function createAgentStorePlan(
  input: LearningStorePlanInput,
): AgentStorePlan {
  const { options, schemaName, isolation, provisioningMode } = input;
  const ttlSeconds = normalizePositiveInteger(
    options.learningMemoryTtlSeconds,
    60 * 60 * 24 * 30,
  );
  const namespace = `${schemaName}_learning`;
  const temporalConfigured = Boolean(
    options.temporalAddress ||
      options.temporalNamespace ||
      options.temporalTaskQueue,
  );
  const graphConfigured = Boolean(options.graphUrl || options.databaseUrl);
  const warnings = learningStoreWarnings(options, temporalConfigured);

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
      namespace: options.temporalNamespace ?? "default",
      provisioningMode,
      isolation,
      createOn: "session_end",
      capabilities: ["workflow_queue"],
      reason: "Runs learnFromSession after RTC shutdown without blocking the user.",
      requiredEnv: ["TEMPORAL_ADDRESS", "TEMPORAL_NAMESPACE", "TEMPORAL_TASK_QUEUE"],
      resources: [{
        kind: "temporal-task-queue",
        name: options.temporalTaskQueue ?? "agent-learning",
        provider: "temporal",
        namespace: options.temporalNamespace ?? "default",
      }],
    },
    temporalMemory: {
      id: "redis-temporal-memory",
      kind: "temporal_memory",
      provider: "redis",
      configured: Boolean(options.redisUrl),
      required: true,
      namespace,
      provisioningMode,
      isolation,
      createOn: "session_end",
      capabilities: ["session_window", "ttl", "fact_memory", "preference_memory"],
      reason: "Stores learned facts, preferences, failed intents, and missing tool signals with tenant/user scope.",
      requiredEnv: ["REDIS_URL"],
      ttlSeconds,
      resources: [{
        kind: "redis-namespace",
        name: namespace,
        provider: "redis",
        namespace,
      }],
    },
    graphMemory: {
      id: "graph-memory",
      kind: "graph_memory",
      provider: options.graphUrl ? "graph" : "postgres",
      configured: graphConfigured,
      required: false,
      namespace: `${namespace}_graph`,
      provisioningMode,
      isolation,
      createOn: "session_end",
      capabilities: ["entity_graph", "relation_graph"],
      reason: "Upserts session entities and relations; Postgres is the local default.",
      requiredEnv: ["DATABASE_URL", "NEO4J_URI", "GRAPH_DATABASE_URL"],
      adapterBoundary: options.graphUrl
        ? plannedStarterAdapterBoundary("graph")
        : undefined,
      resources: [{
        kind: "graph-memory-space",
        name: `${namespace}_graph`,
        provider: options.graphUrl ? "graph" : "postgres",
        namespace,
      }],
    },
    auditStore: {
      id: "learning-audit-source",
      kind: "audit_source",
      provider: "postgres",
      configured: Boolean(options.databaseUrl),
      required: true,
      namespace,
      provisioningMode,
      isolation,
      createOn: "session_end",
      capabilities: ["audit_log", "source_archive"],
      reason: "Records every automatic evolution and rollback pointer append-only.",
      requiredEnv: ["DATABASE_URL"],
      resources: [{
        kind: "agent-version-audit",
        name: `${namespace}_agent_versions`,
        provider: "postgres",
        namespace,
      }],
    },
    vectorBackend: createVectorLearningBackend(input, namespace),
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

export function storePlanEnvRefs(plan: AgentStorePlan): string[] {
  return uniqueList(storePlanBackends(plan).flatMap((backend) => backend.requiredEnv ?? []));
}

export function storePlanResources(plan: AgentStorePlan): InfraResourceRef[] {
  return storePlanBackends(plan).flatMap((backend) => backend.resources ?? []);
}

function learningStoreWarnings(
  options: IntentInfraPlannerOptions,
  temporalConfigured: boolean,
): string[] {
  return [
    !options.redisUrl &&
      "Learning temporal memory is enabled; REDIS_URL is required for the Redis memory store.",
    !temporalConfigured &&
      "Learning workflow is enabled; TEMPORAL_ADDRESS or a local Temporal worker must be configured.",
    !options.databaseUrl &&
      "Learning audit/source store is enabled; DATABASE_URL is required for durable version audit.",
  ].filter((warning): warning is string => Boolean(warning));
}

function createVectorLearningBackend(
  input: LearningStorePlanInput,
  namespace: string,
): AgentStorePlan["vectorBackend"] {
  const { options, isolation, provisioningMode } = input;
  if (!isMilvusRequested(options.defaultVectorBackend)) return undefined;
  return {
    id: "learning-vector-memory",
    kind: "vector_memory",
    provider: "milvus",
    configured: Boolean(options.milvusUrl),
    required: false,
    namespace: `${namespace}_vectors`,
    provisioningMode,
    isolation,
    createOn: "session_end",
    capabilities: ["vector_search"],
    reason: "Optional vector slot for long-horizon learned memory retrieval.",
    requiredEnv: ["MILVUS_URL", "MILVUS_ADDRESS"],
    adapterBoundary: plannedStarterAdapterBoundary("milvus"),
  };
}

function storePlanBackends(plan: AgentStorePlan): AgentLearningStoreBackendPlan[] {
  return [
    plan.temporalWorkflow,
    plan.temporalMemory,
    plan.graphMemory,
    plan.auditStore,
    plan.vectorBackend,
  ].filter((backend): backend is AgentLearningStoreBackendPlan => Boolean(backend));
}
