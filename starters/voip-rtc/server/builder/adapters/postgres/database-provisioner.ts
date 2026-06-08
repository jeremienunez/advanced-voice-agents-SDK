import type {
  DatabaseProvisionInput,
  DatabaseProvisionResult,
  DatabaseProvisionValidation,
  DatabaseProvisionerPort,
} from "@voiceagentsdk/core/sdk";
import postgres from "postgres";
import { validateDatabaseProvisionInput } from "../../domain/database/provisioning.js";
import { splitSqlStatements } from "../../domain/database/sql.js";
import {
  agentRuntimeRoleName,
  ensureAgentKnowledgeTables,
} from "../../../infra/postgres/knowledge-schema.js";

export class PostgresAgentDatabaseProvisioner
  implements DatabaseProvisionerPort {
  constructor(private readonly config: { databaseUrl?: string }) {}

  isConfigured(): boolean {
    return Boolean(this.config.databaseUrl);
  }

  validate(input: DatabaseProvisionInput): DatabaseProvisionValidation {
    return validateDatabaseProvisionInput(input);
  }

  async apply(input: DatabaseProvisionInput): Promise<DatabaseProvisionResult> {
    if (!this.config.databaseUrl) {
      throw new Error("DATABASE_URL is required to provision the agent database");
    }
    const validation = this.validate(input);
    if (!validation.ok) {
      throw new Error(`SQL validation failed: ${validation.errors.join("; ")}`);
    }

    const statements = splitSqlStatements(input.plan.sqlMigration);
    const sql = postgres(this.config.databaseUrl, { max: 1 });
    try {
      await sql.begin(async (tx) => {
        await ensureAgentKnowledgeTables(
          tx,
          input.plan.schemaName,
          Number(input.plan.vectorization.dimensions),
        );
      });
    } finally {
      await sql.end();
    }

    return {
      status: "applied",
      schemaName: input.plan.schemaName,
      appliedStatements: [
        `validated ${statements.length} planned migration statements`,
        "applied server-owned pgvector knowledge schema templates",
        "enforced provisioning and runtime statement_timeout",
        `ensured least-privilege runtime role ${agentRuntimeRoleName(input.plan.schemaName)}`,
      ],
      warnings: validation.warnings,
      appliedAt: new Date().toISOString(),
    };
  }
}
