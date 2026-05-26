import type {
  DatabaseProvisionInput,
  DatabaseProvisionResult,
  DatabaseProvisionValidation,
  DatabaseProvisionerPort,
} from "@voiceagentsdk/core/sdk";
import postgres from "postgres";
import { validateDatabaseProvisionInput } from "../domain/database-provisioning.js";
import { splitSqlStatements } from "../domain/sql.js";
import { ensureAgentKnowledgeTables } from "../../infra/postgres/knowledge-schema.js";

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
        for (const statement of statements) {
          await tx.unsafe(statement);
        }
        await ensureAgentKnowledgeTables(
          tx,
          input.plan.schemaName,
          input.plan.vectorization.dimensions,
        );
      });
    } finally {
      await sql.end();
    }

    return {
      status: "applied",
      schemaName: input.plan.schemaName,
      appliedStatements: [
        ...statements,
        "ensure runtime knowledge_documents/knowledge_chunks contract",
      ],
      warnings: validation.warnings,
      appliedAt: new Date().toISOString(),
    };
  }
}
