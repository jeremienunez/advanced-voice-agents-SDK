import type {
  AgentBuildDraft,
  DatabaseBuildPlan,
  DatabaseBuildRequest,
  JsonObject,
} from "@voiceagentsdk/core/sdk";
import { asRecord, readString, toJsonValue } from "../utils.js";
import { validateDatabaseProvisionInput } from "./database-provisioning.js";
import {
  agentSchemaName,
  compactSql,
  databaseStatementPurpose,
  quoteIdentifier,
} from "./sql.js";

export function fallbackDatabasePlan(
  input: DatabaseBuildRequest,
): DatabaseBuildPlan {
  const schemaName = agentSchemaName(input.draft.id);
  const kgEnabled = input.knowledgePlan?.kg.enabled ?? false;
  const dimensions = 1024;
  const statements = [
    "create extension if not exists vector",
    `create schema if not exists ${quoteIdentifier(schemaName)}`,
    `
      create table if not exists ${quoteIdentifier(schemaName)}.knowledge_documents (
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
    `,
    `
      create table if not exists ${quoteIdentifier(schemaName)}.knowledge_chunks (
        id text primary key,
        draft_id text not null,
        document_id text not null references ${quoteIdentifier(schemaName)}.knowledge_documents(id) on delete cascade,
        ordinal integer not null,
        content text not null,
        token_estimate integer not null,
        embedding vector(${dimensions}),
        metadata jsonb not null default '{}'::jsonb,
        search tsvector generated always as (to_tsvector('simple', content)) stored,
        created_at timestamptz not null default now()
      )
    `,
    `
      create index if not exists knowledge_chunks_search_idx
      on ${quoteIdentifier(schemaName)}.knowledge_chunks using gin (search)
    `,
    `
      create index if not exists knowledge_chunks_embedding_hnsw_idx
      on ${quoteIdentifier(schemaName)}.knowledge_chunks using hnsw (embedding vector_cosine_ops)
    `,
    ...kgStatements(schemaName, kgEnabled),
  ].map(compactSql);

  return {
    id: `db_plan_${input.draft.id}`,
    status: "planned",
    databaseProvider: "postgres-pgvector",
    schemaName,
    sqlMigration: statements.map((statement) => `${statement};`).join("\n"),
    statements: statements.map((statement, index) => ({
      id: `stmt_${index + 1}`,
      sql: statement,
      purpose: databaseStatementPurpose(statement),
      riskLevel: "low",
    })),
    tables: databaseTables(schemaName),
    indexes: databaseIndexes(schemaName),
    vectorization: {
      embeddingProvider: "voyage",
      embeddingModel: "voyage-4-large",
      dimensions,
      sourceFields: ["knowledge_chunks.content"],
      metadataFields: ["document_id", "documentName", "ordinal", "kind"],
      retrievalMode:
        input.knowledgePlan?.strategy === "vector" ? "vector" : "hybrid",
      chunking: input.knowledgePlan?.chunking ?? {
        method: "semantic",
        targetTokens: 420,
        overlapTokens: 72,
        rationale: "Default voice-agent chunks keep answers compact.",
      },
      index: {
        kind: "hnsw",
        metric: "cosine",
        m: 16,
        efConstruction: 64,
      },
      rationale:
        "Hybrid Postgres FTS + pgvector HNSW supports precise route names and semantic travel questions.",
    },
    kg: input.knowledgePlan?.kg ?? {
      enabled: false,
      entityTypes: [],
      relationTypes: [],
    },
    repositories: {
      repositories: [
        {
          id: "knowledgeRepository",
          table: `${schemaName}.knowledge_chunks`,
          operations: ["search", "list", "get"],
          filterFields: ["draft_id", "document_id"],
          sortFields: ["ordinal", "created_at"],
          maxPageSize: 20,
          vectorSearch: true,
          lexicalSearch: true,
        },
      ],
      safetyRules: [
        "Read-only repository in v1.",
        "Always scope queries by draft_id or schema.",
        "Cap page size to avoid accidental full scans.",
      ],
      rationale: "The runtime only needs safe retrieval primitives for voice answers.",
    },
    reasons: [
      "One schema per agent keeps generated knowledge isolated.",
      "Postgres FTS covers exact route/appellation names.",
      "pgvector HNSW covers semantic travel questions.",
    ],
    risks: [
      "Generated SQL must remain allowlisted before execution.",
      "Large spreadsheets may need batching beyond the demo file.",
    ],
  };
}

export function normalizeDatabasePlan(
  result: DatabaseBuildPlan,
  fallback: DatabaseBuildPlan,
): DatabaseBuildPlan {
  const schemaName = fallback.schemaName;
  const plan = asRecord(result);
  const sqlMigration = readString(plan, "sqlMigration") || fallback.sqlMigration;
  const next: DatabaseBuildPlan = {
    ...fallback,
    ...result,
    id: readString(plan, "id") || fallback.id,
    status: "planned",
    databaseProvider:
      readString(plan, "databaseProvider") || fallback.databaseProvider,
    schemaName,
    sqlMigration,
    statements: Array.isArray(result.statements)
      ? result.statements
      : fallback.statements,
    tables: Array.isArray(result.tables) ? result.tables : fallback.tables,
    indexes: Array.isArray(result.indexes) ? result.indexes : fallback.indexes,
    vectorization: result.vectorization ?? fallback.vectorization,
    kg: result.kg ?? fallback.kg,
    repositories: result.repositories ?? fallback.repositories,
    reasons: Array.isArray(result.reasons) ? result.reasons : fallback.reasons,
    risks: Array.isArray(result.risks) ? result.risks : fallback.risks,
    raw: toJsonValue(result) as JsonObject,
  };

  const validation = validateDatabaseProvisionInput({
    draft: { id: schemaName.replace(/^agent_/, "") } as AgentBuildDraft,
    plan: next,
  });
  if (!validation.ok) return fallback;
  return next;
}

function kgStatements(schemaName: string, enabled: boolean): string[] {
  if (!enabled) return [];
  return [
    `
      create table if not exists ${quoteIdentifier(schemaName)}.kg_entities (
        id text primary key,
        draft_id text not null,
        label text not null,
        entity_type text not null,
        aliases text[] not null default '{}',
        source_document_ids text[] not null default '{}',
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    `,
    `
      create table if not exists ${quoteIdentifier(schemaName)}.kg_edges (
        id text primary key,
        draft_id text not null,
        source_entity_id text not null references ${quoteIdentifier(schemaName)}.kg_entities(id) on delete cascade,
        target_entity_id text not null references ${quoteIdentifier(schemaName)}.kg_entities(id) on delete cascade,
        relation_type text not null,
        evidence text,
        source_document_id text,
        confidence numeric(4,3),
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    `,
    `
      create index if not exists kg_entities_type_idx
      on ${quoteIdentifier(schemaName)}.kg_entities using btree (entity_type)
    `,
    `
      create index if not exists kg_edges_relation_idx
      on ${quoteIdentifier(schemaName)}.kg_edges using btree (relation_type)
    `,
  ];
}

function databaseTables(schemaName: string): DatabaseBuildPlan["tables"] {
  return [
    {
      id: `${schemaName}.knowledge_documents`,
      description: "Validated source documents for one compiled voice agent.",
      primaryKey: "id",
      fields: {
        type: "object",
        properties: {
          id: { type: "string" },
          draft_id: { type: "string" },
          name: { type: "string" },
          kind: { type: "string" },
          content: { type: "string" },
          metadata: { type: "object" },
        },
      },
      indexes: ["primary"],
    },
    {
      id: `${schemaName}.knowledge_chunks`,
      description: "Chunked text, lexical tsvector, and pgvector embeddings.",
      primaryKey: "id",
      fields: {
        type: "object",
        properties: {
          id: { type: "string" },
          document_id: { type: "string" },
          content: { type: "string" },
          token_estimate: { type: "number" },
          embedding: { type: "array", items: { type: "number" } },
          metadata: { type: "object" },
        },
      },
      indexes: ["knowledge_chunks_search_idx", "knowledge_chunks_embedding_hnsw_idx"],
    },
  ];
}

function databaseIndexes(schemaName: string): DatabaseBuildPlan["indexes"] {
  return [
    {
      id: `${schemaName}.knowledge_chunks_search_idx`,
      table: `${schemaName}.knowledge_chunks`,
      kind: "gin",
      fields: ["search"],
    },
    {
      id: `${schemaName}.knowledge_chunks_embedding_hnsw_idx`,
      table: `${schemaName}.knowledge_chunks`,
      kind: "hnsw",
      fields: ["embedding"],
    },
  ];
}
