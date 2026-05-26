import type { DatabaseBuildPlan } from "@voiceagentsdk/core/sdk";

export function agentSchemaName(draftId: string): string {
  const normalized = draftId
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const suffix = normalized || "draft";
  return `agent_${suffix}`.slice(0, 60);
}

export function appliedAgentSchema(
  plan?: DatabaseBuildPlan,
): string | undefined {
  if (!plan || plan.status !== "applied") return undefined;
  if (!isSafeIdentifier(plan.schemaName)) return undefined;
  return plan.schemaName;
}

export function quoteIdentifier(identifier: string): string {
  if (!isSafeIdentifier(identifier)) {
    throw new Error(`Unsafe SQL identifier "${identifier}"`);
  }
  return `"${identifier}"`;
}

export function isSafeIdentifier(identifier: string): boolean {
  return /^[a-z][a-z0-9_]{0,62}$/.test(identifier);
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const previous = sql[index - 1];
    if ((char === "'" || char === "\"") && previous !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === ";" && !quote) {
      const statement = compactSql(current);
      if (statement) statements.push(statement);
      current = "";
      continue;
    }
    current += char;
  }

  const tail = compactSql(current);
  if (tail) statements.push(tail);
  return statements;
}

export function validateSqlStatement(
  statement: string,
  schemaName: string,
): string[] {
  const errors: string[] = [];
  const normalized = statement.toLowerCase();
  const allowedStarts = [
    "create extension",
    "create schema",
    "create table",
    "create index",
  ];
  const forbiddenPatterns = [
    /\bdrop\b/i,
    /\btruncate\b/i,
    /\balter\s+system\b/i,
    /\balter\s+(database|role|user)\b/i,
    /\bcreate\s+(function|trigger|procedure|rule)\b/i,
    /\bcopy\s+.+\bprogram\b/i,
    /\bexecute\b/i,
    /\bgrant\b/i,
    /\brevoke\b/i,
    /^\s*insert\b/i,
    /^\s*update\b/i,
    /^\s*delete\b/i,
  ];

  if (!allowedStarts.some((prefix) => normalized.startsWith(prefix))) {
    errors.push(`SQL statement is not allowlisted: ${statement.slice(0, 80)}`);
  }
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(statement)) {
      errors.push(`Forbidden SQL pattern "${pattern}" in statement`);
    }
  }
  if (normalized.startsWith("create extension") && !/\bvector\b/i.test(statement)) {
    errors.push("Only the vector extension may be created");
  }
  if (
    !normalized.startsWith("create extension") &&
    !statement.includes(quoteIdentifier(schemaName)) &&
    !statement.includes(`${schemaName}.`)
  ) {
    errors.push(`Statement must be scoped to schema "${schemaName}"`);
  }
  if (/\bpublic\.(?!vector\b)/i.test(statement)) {
    errors.push("Cross-schema public object references are not allowed");
  }
  return errors;
}

export function compactSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

export function databaseStatementPurpose(statement: string): string {
  const lower = statement.toLowerCase();
  if (lower.startsWith("create extension")) return "Enable pgvector";
  if (lower.startsWith("create schema")) return "Create isolated agent schema";
  if (lower.startsWith("create table")) return "Create agent knowledge table";
  if (lower.startsWith("create index")) return "Create retrieval index";
  return "Apply safe DDL";
}

export function vectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
