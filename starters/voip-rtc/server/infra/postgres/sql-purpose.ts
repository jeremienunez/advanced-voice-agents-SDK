export function databaseStatementPurpose(statement: string): string {
  const lower = statement.toLowerCase();
  if (lower.startsWith("create extension")) return "Enable pgvector";
  if (lower.startsWith("create schema")) return "Create isolated agent schema";
  if (lower.startsWith("create table")) return "Create agent knowledge table";
  if (lower.startsWith("create index")) return "Create retrieval index";
  return "Apply safe DDL";
}
