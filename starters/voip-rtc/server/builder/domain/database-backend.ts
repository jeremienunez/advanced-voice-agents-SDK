import type { DatabaseBackendPlan } from "@voiceagentsdk/core/sdk";
import type { BackendPlanInput } from "./infra-backend-input.js";
import { createRuntimeDatabaseCredentialRef } from "./runtime-db-credential-ref.js";

export function createDatabaseBackend(
  input: BackendPlanInput,
): DatabaseBackendPlan {
  const { options, schemaName, isolation, provisioningMode } = input;
  const runtimeCredentialRef = createRuntimeDatabaseCredentialRef(schemaName);
  return {
    id: "postgres-primary",
    provider: "postgres-pgvector",
    configured: Boolean(options.databaseUrl),
    namespace: schemaName,
    schemaName,
    runtimeCredentialRef,
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
