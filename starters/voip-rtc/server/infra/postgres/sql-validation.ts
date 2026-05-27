import { quoteIdentifier } from "./sql-identifiers.js";

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

  if (isCreateTableAsSelect(statement)) {
    errors.push("CREATE TABLE AS SELECT is not allowed");
  }
  if (isExpressionIndex(statement)) {
    errors.push("Expression indexes are not allowed");
  }
  if (!allowedStarts.some((prefix) => normalized.startsWith(prefix))) {
    errors.push(`SQL statement is not allowlisted: ${statement.slice(0, 80)}`);
  }
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(statement)) {
      errors.push(`Forbidden SQL pattern "${pattern}" in statement`);
    }
  }
  if (normalized.startsWith("create extension")) {
    errors.push(...validateExtensionStatement(statement));
  } else {
    errors.push(...validateFunctionCalls(statement));
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

function validateExtensionStatement(statement: string): string[] {
  const match = statement.match(
    /^create\s+extension\s+(?:if\s+not\s+exists\s+)?("?)([a-z0-9_]+)\1$/i,
  );
  if (!match) {
    return ["Extension statements must not include arbitrary options"];
  }
  return match[2].toLowerCase() === "vector"
    ? []
    : ["Only the vector extension may be created"];
}

function validateFunctionCalls(statement: string): string[] {
  const allowedFunctions = new Set([
    "as",
    "btree",
    "gin",
    "hnsw",
    "now",
    "to_tsvector",
    "vector",
    "numeric",
    "decimal",
    "varchar",
  ]);
  const errors: string[] = [];
  const calls = statement.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi);
  for (const call of calls) {
    const name = call[1].toLowerCase();
    const previousChar = statement[Math.max(0, (call.index ?? 0) - 1)];
    if (previousChar === "." || allowedFunctions.has(name)) continue;
    errors.push(`Arbitrary SQL function call "${name}" is not allowed`);
  }
  return errors;
}

function isCreateTableAsSelect(statement: string): boolean {
  return /\bcreate\s+(?:temp\s+|temporary\s+|unlogged\s+)?table\b[\s\S]*\bas\s+select\b/i
    .test(statement);
}

function isExpressionIndex(statement: string): boolean {
  if (!/^\s*create\s+index\b/i.test(statement)) return false;
  const indexTarget = statement.match(/\bon\s+.+?\s+(?:using\s+\w+\s+)?\((.+)\)\s*$/i)?.[1];
  return Boolean(indexTarget && /\b[a-z_][a-z0-9_]*\s*\(/i.test(indexTarget));
}
