import type {
  AgentBuildDraft,
  DatabaseBuildPlan,
} from "@voiceagentsdk/core/sdk";
import type postgres from "postgres";
import { PostgresAgentDatabaseProvisioner } from "../../../server/builder/adapters/postgres/database-provisioner.js";
import { fallbackDatabasePlan } from "../../../server/builder/domain/database/plan.js";
import { quoteIdentifier } from "../../../server/builder/domain/database/sql.js";
import { ensureAgentKnowledgeTables } from "../../../server/infra/postgres/knowledge-schema.js";
import { assert } from "../shared/assertions.js";

const draft = agentDraft();
const baseline = fallbackDatabasePlan({ draft, documents: [] });
const schema = quoteIdentifier(baseline.schemaName);
const provisioner = new PostgresAgentDatabaseProvisioner({});

const results = [
  scenarioValidTemplatePlanPasses(),
  scenarioHostileSqlIsRejected(),
  await scenarioServerTemplateEnforcesLeastPrivilege(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioValidTemplatePlanPasses() {
  const validation = provisioner.validate({ draft, plan: baseline });
  assert(validation.ok, `baseline plan should validate: ${validation.errors.join("; ")}`);
  assert(
    baseline.sqlMigration.includes("create extension if not exists vector"),
    "baseline must stay on the server-owned pgvector path",
  );
  return "valid-template-plan";
}

function scenarioHostileSqlIsRejected() {
  const cases = [
    {
      name: "non-vector-extension",
      sql: "create extension if not exists hstore;",
      expected: "Only the vector extension may be created",
    },
    {
      name: "extension-options",
      sql: "create extension if not exists vector with schema public;",
      expected: "Extension statements must not include arbitrary options",
    },
    {
      name: "create-table-as-select",
      sql: `create table if not exists ${schema}.evil as select * from ${schema}.knowledge_chunks;`,
      expected: "CREATE TABLE AS SELECT is not allowed",
    },
    {
      name: "arbitrary-function-call",
      sql: `create table if not exists ${schema}.evil (id text default gen_random_uuid());`,
      expected: 'Arbitrary SQL function call "gen_random_uuid" is not allowed',
    },
    {
      name: "expression-index",
      sql: `create index if not exists evil_idx on ${schema}.knowledge_chunks using btree (lower(content));`,
      expected: "Expression indexes are not allowed",
    },
  ];

  for (const item of cases) {
    const validation = provisioner.validate({
      draft,
      plan: withMigration(baseline, item.sql),
    });
    assert(!validation.ok, `${item.name} must fail validation`);
    assert(
      validation.errors.some((error) => error.includes(item.expected)),
      `${item.name} must include "${item.expected}": ${validation.errors.join("; ")}`,
    );
  }

  return "hostile-sql-rejections";
}

async function scenarioServerTemplateEnforcesLeastPrivilege() {
  const captured: string[] = [];
  const sql = {
    unsafe(query: string) {
      captured.push(compact(query));
      return Promise.resolve([]);
    },
  };

  await ensureAgentKnowledgeTables(
    sql as unknown as Pick<postgres.Sql, "unsafe">,
    baseline.schemaName,
    Number(baseline.vectorization.dimensions),
  );

  assert(
    captured.some((statement) => statement.startsWith("set local statement_timeout")),
    "server-owned template must bound provisioning statements with statement_timeout",
  );
  assert(
    captured.some((statement) => /\bcreate role\b.+\bnologin\b/i.test(statement)),
    "server-owned template must create a no-login least-privilege runtime role",
  );
  assert(
    captured.some((statement) => /\balter role\b.+\bstatement_timeout\b/i.test(statement)),
    "runtime role must have a statement_timeout",
  );
  assert(
    captured.some((statement) => /\bgrant usage on schema\b/i.test(statement)),
    "runtime role must receive schema usage only",
  );
  assert(
    captured.some((statement) => /\bgrant select on all tables in schema\b/i.test(statement)),
    "runtime role must receive table select only",
  );
  assert(
    !captured.some((statement) => /\bgrant\s+(insert|update|delete|all|create)\b/i.test(statement)),
    "runtime role must not receive write or create grants",
  );

  return "server-template-least-privilege";
}

function withMigration(
  plan: DatabaseBuildPlan,
  sqlMigration: string,
): DatabaseBuildPlan {
  return {
    ...plan,
    sqlMigration,
    statements: [{
      id: "stmt_hostile",
      purpose: "hostile test statement",
      riskLevel: "high",
      sql: sqlMigration,
    }],
  };
}

function agentDraft(): AgentBuildDraft {
  const now = new Date(0).toISOString();
  return {
    id: "draft_db_hardening",
    status: "draft",
    identity: {
      builderFirstName: "Db",
      builderLastName: "Tester",
      publicAgentName: "DB Hardening Agent",
      intent: "Validate database provisioning hardening",
      mustDo: [],
      mustNotDo: [],
    },
    toolRegistry: [],
    selectedTools: [],
    promptParts: {},
    createdAt: now,
    updatedAt: now,
  };
}

function compact(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}
