import type postgres from "postgres";
import { quoteIdentifier } from "./sql.js";

export async function ensureAgentKnowledgeTables(
  sql: Pick<postgres.Sql, "unsafe">,
  schemaName: string,
  dimensions: number,
): Promise<void> {
  const schema = quoteIdentifier(schemaName);
  const vectorDimensions = safeVectorDimensions(dimensions);
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
}

function safeVectorDimensions(dimensions: number): number {
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 4096) {
    throw new Error("Vector dimensions must be an integer between 1 and 4096");
  }
  return dimensions;
}
