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
