import type {
  InfraComputeTarget,
  InfraIsolationMode,
  InfraPlanRequest,
  InfraProvisioningMode,
} from "@voiceagentsdk/core/sdk";

export interface IntentInfraPlannerOptions {
  computeTarget?: string;
  databaseUrl?: string;
  defaultVectorBackend?: string;
  learningEnabled?: string | boolean;
  learningMemoryTtlSeconds?: string | number;
  graphUrl?: string;
  isolation?: string;
  milvusUrl?: string;
  provisioningMode?: string;
  redisUrl?: string;
  temporalAddress?: string;
  temporalNamespace?: string;
  temporalTaskQueue?: string;
}

export const vectorScaleTerms = [
  "embedding",
  "embeddings",
  "high volume",
  "large corpus",
  "million",
  "milvus",
  "rag",
  "semantic",
  "vector",
];

export const graphTerms = [
  "entity",
  "entities",
  "graph",
  "kg",
  "knowledge graph",
  "ontology",
  "relation",
  "relationship",
];

export const cacheTerms = ["cache", "latency", "session", "stateful"];

export function searchableIntent(input: InfraPlanRequest): string {
  const identity = input.draft.identity;
  const documentNames = (input.documents ?? [])
    .map((document) => document.name)
    .join(" ");
  return [
    identity.publicAgentName,
    identity.intent,
    ...identity.mustDo,
    ...identity.mustNotDo,
    input.knowledgePlan?.strategy,
    documentNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function isMilvusRequested(value: string | undefined): boolean {
  const normalized = normalizeToken(value);
  return normalized === "milvus" || normalized === "milvus_vector";
}

export function normalizeBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  const normalized = normalizeToken(value);
  if (!normalized) return false;
  return !["0", "false", "no", "off", "disabled"].includes(normalized);
}

export function normalizePositiveInteger(
  value: string | number | undefined,
  fallback: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function normalizeComputeTarget(
  value: string | undefined,
): InfraComputeTarget {
  const normalized = normalizeToken(value);
  if (normalized === "vm") return "vm";
  if (normalized === "k3" || normalized === "k3s") return "k3s";
  if (normalized === "k8s" || normalized === "kubernetes") return "kubernetes";
  if (normalized === "managed") return "managed";
  return "local";
}

export function normalizeIsolation(value: string | undefined): InfraIsolationMode {
  const normalized = normalizeToken(value);
  if (normalized === "shared_cluster") return "shared_cluster";
  if (normalized === "dedicated_database") return "dedicated_database";
  if (normalized === "dedicated_vm") return "dedicated_vm";
  if (normalized === "dedicated_cluster") return "dedicated_cluster";
  return "namespace";
}

export function normalizeProvisioningMode(
  value: string | undefined,
): InfraProvisioningMode {
  const normalized = normalizeToken(value);
  if (normalized === "manual") return "manual";
  if (normalized === "iac" || normalized === "iac_plan") return "iac_plan";
  if (normalized === "external") return "external";
  return "server_template";
}

export function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeToken(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
}
