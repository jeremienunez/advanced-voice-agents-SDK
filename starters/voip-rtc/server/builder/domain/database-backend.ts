import type { DatabaseBackendPlan } from "@voiceagentsdk/core/sdk";
import type { BackendPlanInput } from "./infra-backend-input.js";

export function createDatabaseBackend(
  input: BackendPlanInput,
): DatabaseBackendPlan {
  const { options, schemaName, isolation, provisioningMode } = input;
  return {
    id: "postgres-primary",
    provider: "postgres-pgvector",
    configured: Boolean(options.databaseUrl),
    namespace: schemaName,
    schemaName,
    provisioningMode,
    isolation,
    reason: "Durable source-of-truth store for agent knowledge, metadata, and pgvector fallback.",
    requiredEnv: ["DATABASE_URL"],
    resources: [{
      kind: "postgres-schema",
      name: schemaName,
      provider: "postgres-pgvector",
      namespace: schemaName,
    }],
  };
}
