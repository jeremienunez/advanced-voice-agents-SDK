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
