import type postgres from "postgres";
import { quoteIdentifier } from "./sql.js";

const provisioningStatementTimeout = "30s";
const runtimeStatementTimeout = "5s";

export async function ensureAgentKnowledgeTables(
  sql: Pick<postgres.Sql, "unsafe">,
  schemaName: string,
  dimensions: number,
): Promise<void> {
  const schema = quoteIdentifier(schemaName);
  const vectorDimensions = safeVectorDimensions(dimensions);
  await sql.unsafe(`set local statement_timeout = '${provisioningStatementTimeout}'`);
  await sql.unsafe("create extension if not exists vector");
  await sql.unsafe(`create schema if not exists ${schema}`);
  await sql.unsafe(`
    create table if not exists ${schema}.knowledge_documents (
      id text primary key,
      draft_id text not null,
      name text not null,
      kind text not null,
      mime_type text,
      size_bytes integer,
      content text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await sql.unsafe(`
    create table if not exists ${schema}.knowledge_chunks (
      id text primary key,
      draft_id text not null,
      document_id text not null references ${schema}.knowledge_documents(id)
        on delete cascade,
      ordinal integer not null,
      content text not null,
      token_estimate integer not null default 0,
      embedding vector(${vectorDimensions}),
      metadata jsonb not null default '{}'::jsonb,
      search tsvector generated always as (to_tsvector('simple', content)) stored,
      created_at timestamptz not null default now()
    )
  `);
  await sql.unsafe(`
    create index if not exists knowledge_chunks_search_idx
    on ${schema}.knowledge_chunks using gin (search)
  `);
  await sql.unsafe(`
    create index if not exists knowledge_chunks_embedding_hnsw_idx
    on ${schema}.knowledge_chunks using hnsw (embedding vector_cosine_ops)
  `);
  await ensureLeastPrivilegeRuntimeRole(sql, schemaName);
}

export function agentRuntimeRoleName(schemaName: string): string {
  return `${schemaName}_rt`;
}

async function ensureLeastPrivilegeRuntimeRole(
  sql: Pick<postgres.Sql, "unsafe">,
  schemaName: string,
): Promise<void> {
  const schema = quoteIdentifier(schemaName);
  const roleName = agentRuntimeRoleName(schemaName);
  const role = quoteIdentifier(roleName);
  const rows = await sql.unsafe(
    "select 1 from pg_roles where rolname = $1",
    [roleName],
  ) as unknown[];

  if (rows.length === 0) {
    await sql.unsafe(`create role ${role} nologin`);
  }
  await sql.unsafe(`alter role ${role} set statement_timeout = '${runtimeStatementTimeout}'`);
  await sql.unsafe(`revoke all on schema ${schema} from public`);
  await sql.unsafe(`grant usage on schema ${schema} to ${role}`);
  await sql.unsafe(`grant select on all tables in schema ${schema} to ${role}`);
  await sql.unsafe(`
    alter default privileges in schema ${schema}
    grant select on tables to ${role}
  `);
}

function safeVectorDimensions(dimensions: number): number {
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 4096) {
    throw new Error("Vector dimensions must be an integer between 1 and 4096");
  }
  return dimensions;
}
