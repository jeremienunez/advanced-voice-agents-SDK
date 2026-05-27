import type {
  KnowledgeSearchInput,
  KnowledgeSearchMode,
  KnowledgeSearchResult,
  KnowledgeSearchResultItem,
  KnowledgeSearchPort,
} from "@voiceagentsdk/core/sdk";
import postgres from "postgres";
import {
  quoteIdentifier,
  vectorLiteral,
} from "../../infra/postgres/sql.js";

type SearchRow = Record<string, unknown>;

export class PostgresKnowledgeSearch implements KnowledgeSearchPort {
  constructor(private readonly config: { databaseUrl?: string }) {}

  isConfigured(): boolean {
    return Boolean(this.config.databaseUrl);
  }

  async search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult> {
    const mode = normalizeMode(input.mode, input.embedding);
    const limit = normalizeLimit(input.limit);
    if (!this.config.databaseUrl) return empty(input.query, mode, "not-configured");

    const sql = postgres(this.config.databaseUrl, { max: 1 });
    try {
      const rows = await queryKnowledge(sql, input.scope, input.query, mode, limit, input.embedding);
      return {
        status: rows.length > 0 ? "ok" : "empty",
        query: input.query,
        mode,
        resultCount: rows.length,
        results: rows.map(rowToResult),
      };
    } finally {
      await sql.end();
    }
  }
}

async function queryKnowledge(
  sql: postgres.Sql,
  scope: { draftId: string; schemaName?: string },
  query: string,
  mode: KnowledgeSearchMode,
  limit: number,
  embedding?: number[],
): Promise<SearchRow[]> {
  if (scope.schemaName) {
    return queryAgentSchema(sql, scope.schemaName, query, mode, limit, embedding);
  }
  return queryGlobalTables(sql, scope.draftId, query, mode, limit, embedding);
}

async function queryAgentSchema(
  sql: postgres.Sql,
  schemaName: string,
  query: string,
  mode: KnowledgeSearchMode,
  limit: number,
  embedding?: number[],
): Promise<SearchRow[]> {
  const schema = quoteIdentifier(schemaName);
  return sql.unsafe(
    searchSql(`${schema}.knowledge_chunks`, `${schema}.knowledge_documents`, mode),
    params(query, mode, limit, embedding) as never[],
  ) as Promise<SearchRow[]>;
}

async function queryGlobalTables(
  sql: postgres.Sql,
  draftId: string,
  query: string,
  mode: KnowledgeSearchMode,
  limit: number,
  embedding?: number[],
): Promise<SearchRow[]> {
  return sql.unsafe(
    searchSql(
      "voice_agent_chunks",
      "voice_agent_documents",
      mode,
      mode === "hybrid" ? 4 : 3,
    ),
    [...params(query, mode, limit, embedding), draftId] as never[],
  ) as Promise<SearchRow[]>;
}

function searchSql(
  chunkTable: string,
  documentTable: string,
  mode: KnowledgeSearchMode,
  draftParamIndex?: number,
): string {
  if (mode === "lexical") return lexicalSql(chunkTable, documentTable, draftParamIndex);
  if (mode === "vector") return vectorSql(chunkTable, documentTable, draftParamIndex);
  return hybridSql(chunkTable, documentTable, draftParamIndex);
}

function lexicalSql(
  chunkTable: string,
  documentTable: string,
  draftParamIndex?: number,
): string {
  return `
    with q as (select websearch_to_tsquery('simple', $1) as tsq)
    select c.id, c.document_id, d.name as document_name, c.ordinal, c.content,
      c.metadata, ts_rank_cd(c.search, q.tsq) as lexical_score,
      null::double precision as vector_score,
      ts_rank_cd(c.search, q.tsq) as score
    from ${chunkTable} c
    join ${documentTable} d on d.id = c.document_id, q
    where c.search @@ q.tsq${draftFilter(draftParamIndex)}
    order by score desc, c.ordinal asc
    limit $2`;
}

function vectorSql(
  chunkTable: string,
  documentTable: string,
  draftParamIndex?: number,
): string {
  return `
    select c.id, c.document_id, d.name as document_name, c.ordinal, c.content,
      c.metadata, 0::double precision as lexical_score,
      (1 - (c.embedding <=> $1::vector)) as vector_score,
      (1 - (c.embedding <=> $1::vector)) as score
    from ${chunkTable} c
    join ${documentTable} d on d.id = c.document_id
    where c.embedding is not null${draftFilter(draftParamIndex)}
    order by c.embedding <=> $1::vector
    limit $2`;
}

function hybridSql(
  chunkTable: string,
  documentTable: string,
  draftParamIndex?: number,
): string {
  return `
    with q as (select websearch_to_tsquery('simple', $1) as tsq)
    select c.id, c.document_id, d.name as document_name, c.ordinal, c.content,
      c.metadata,
      case when c.search @@ q.tsq then ts_rank_cd(c.search, q.tsq) else 0 end as lexical_score,
      (1 - (c.embedding <=> $2::vector)) as vector_score,
      (case when c.search @@ q.tsq then ts_rank_cd(c.search, q.tsq) else 0 end * 0.35
        + (1 - (c.embedding <=> $2::vector)) * 0.65) as score
    from ${chunkTable} c
    join ${documentTable} d on d.id = c.document_id, q
    where (c.embedding is not null or c.search @@ q.tsq)${draftFilter(draftParamIndex)}
    order by score desc, c.ordinal asc
    limit $3`;
}

function draftFilter(paramIndex: number | undefined): string {
  return paramIndex ? ` and c.draft_id = $${paramIndex}` : "";
}

function params(
  query: string,
  mode: KnowledgeSearchMode,
  limit: number,
  embedding?: number[],
): unknown[] {
  if (mode === "lexical") return [query, limit];
  const vector = vectorLiteral(embedding ?? []);
  return mode === "vector" ? [vector, limit] : [query, vector, limit];
}

function rowToResult(row: SearchRow): KnowledgeSearchResultItem {
  return {
    chunkId: String(row.id),
    documentId: String(row.document_id),
    documentName: String(row.document_name),
    ordinal: Number(row.ordinal),
    content: String(row.content),
    score: Number(row.score ?? 0),
    lexicalScore: numeric(row.lexical_score),
    vectorScore: numeric(row.vector_score),
    metadata: asRecord(row.metadata),
  };
}

function normalizeMode(
  mode: KnowledgeSearchMode | undefined,
  embedding?: number[],
): KnowledgeSearchMode {
  const selected = mode ?? "hybrid";
  return selected === "lexical" || embedding?.length ? selected : "lexical";
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(Math.trunc(limit ?? 5), 1), 8);
}

function empty(
  query: string,
  mode: KnowledgeSearchMode,
  status: KnowledgeSearchResult["status"],
): KnowledgeSearchResult {
  return { status, query, mode, resultCount: 0, results: [] };
}

function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}
