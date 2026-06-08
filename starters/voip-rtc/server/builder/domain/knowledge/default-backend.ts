import type { KnowledgeBackendPlan } from "@voiceagentsdk/core/sdk";

export function resolveDefaultBackendId(
  backends: KnowledgeBackendPlan[],
  explicitMilvus: boolean,
  wantsVectorScale: boolean,
): string {
  const milvus = backends.find((backend) => backend.id === "milvus-vector");
  if (explicitMilvus && milvus) return milvus.id;
  if (wantsVectorScale && milvus?.configured) return milvus.id;
  return "postgres-primary";
}
