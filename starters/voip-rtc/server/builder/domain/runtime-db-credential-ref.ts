import type { RuntimeDatabaseCredentialRef } from "@voiceagentsdk/core/sdk";

export function createRuntimeDatabaseCredentialRef(
  schemaName: string,
): RuntimeDatabaseCredentialRef {
  return {
    name: `postgres-runtime-${schemaName}`,
    provider: "postgres-pgvector",
    scope: "agent",
    schemaName,
    roleName: `${schemaName}_rt`,
    envName: `AGENT_DB_RUNTIME_URL_${envToken(schemaName)}`,
  };
}

function envToken(value: string): string {
  const token = value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return token || "AGENT";
}
