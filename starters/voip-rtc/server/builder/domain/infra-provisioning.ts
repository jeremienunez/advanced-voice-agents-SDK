import type {
  InfraProvisionInput,
  InfraProvisionValidation,
  KnowledgeBackendPlan,
} from "@voiceagentsdk/core/sdk";

export function validateInfraProvisionInput(
  input: InfraProvisionInput,
): InfraProvisionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const backendIds = new Set<string>();

  if (input.plan.draftId !== input.draft.id) {
    errors.push(`Infra plan draftId must match draft "${input.draft.id}"`);
  }
  if (!input.plan.id) errors.push("Infra plan id is required");
  if (!input.plan.database.id) errors.push("Database backend id is required");
  if (!input.plan.database.namespace) {
    errors.push("Database backend namespace is required");
  }

  for (const backend of input.plan.knowledgeBackends) {
    validateBackend(backend, backendIds, errors, warnings);
  }

  if (!backendIds.has(input.plan.defaultBackendId)) {
    errors.push(`Default backend "${input.plan.defaultBackendId}" is not planned`);
  }
  if (!backendIds.has(input.plan.database.id)) {
    errors.push(`Database backend "${input.plan.database.id}" is not in backends`);
  }
  if (input.plan.migrationPolicy.allowGeneratedSql) {
    errors.push("Infra plans must not allow generated SQL execution");
  }
  if (
    input.plan.database.schemaName &&
    input.plan.migrationPolicy.versionTable &&
    !input.plan.migrationPolicy.versionTable.startsWith(
      `${input.plan.database.schemaName}.`,
    )
  ) {
    errors.push("Migration version table must stay inside the agent schema");
  }
  if (
    input.plan.computeTarget === "local" &&
    input.plan.security.networkPolicy !== "local_only"
  ) {
    warnings.push("Local compute should normally use a local_only network policy");
  }
  if (!input.plan.security.tenantScoped) {
    errors.push("Infra plan must be tenant scoped");
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? "validated" : "failed",
    errors,
    warnings,
  };
}

function validateBackend(
  backend: KnowledgeBackendPlan,
  backendIds: Set<string>,
  errors: string[],
  warnings: string[],
): void {
  if (!backend.id) errors.push("Knowledge backend id is required");
  if (backendIds.has(backend.id)) {
    errors.push(`Duplicate knowledge backend id "${backend.id}"`);
  }
  backendIds.add(backend.id);

  if (!backend.provider) errors.push(`Backend "${backend.id}" has no provider`);
  if (!backend.namespace) errors.push(`Backend "${backend.id}" has no namespace`);
  if (backend.capabilities.length === 0) {
    errors.push(`Backend "${backend.id}" must expose at least one capability`);
  }
  if (backend.required && !backend.configured) {
    warnings.push(
      `Required backend "${backend.id}" is planned but not configured yet`,
    );
  }
}
