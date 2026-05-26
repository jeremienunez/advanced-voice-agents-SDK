import type {
  DatabaseProvisionInput,
  DatabaseProvisionValidation,
} from "@voiceagentsdk/core/sdk";
import {
  agentSchemaName,
  isSafeIdentifier,
  splitSqlStatements,
  validateSqlStatement,
} from "./sql.js";

export function validateDatabaseProvisionInput(
  input: DatabaseProvisionInput,
): DatabaseProvisionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expectedSchema = agentSchemaName(input.draft.id);
  const schemaName = input.plan.schemaName;

  if (schemaName !== expectedSchema) {
    errors.push(
      `Schema must be "${expectedSchema}" for draft "${input.draft.id}"`,
    );
  }
  if (!isSafeIdentifier(schemaName)) {
    errors.push(`Unsafe schema identifier "${schemaName}"`);
  }

  const statements = splitSqlStatements(input.plan.sqlMigration);
  if (statements.length === 0) {
    errors.push("SQL migration is empty");
  }

  for (const statement of statements) {
    errors.push(...validateSqlStatement(statement, schemaName));
  }

  if (input.plan.vectorization.dimensions !== 1024) {
    warnings.push("Voyage starter expects 1024-dimensional embeddings in v1");
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? "validated" : "failed",
    errors,
    warnings,
  };
}
