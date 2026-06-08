import type {
  KnowledgeStoreCompileInput,
  KnowledgeStoreCompileResult,
  KnowledgeStorePort,
} from "@voiceagentsdk/core/sdk";
import postgres from "postgres";
import { appliedAgentSchema, quoteIdentifier, vectorLiteral } from "../../domain/database/sql.js";
import { toJsonValue } from "../../utils/json-payload.js";
import { ensureAgentKnowledgeTables } from "../../../infra/postgres/knowledge-schema.js";

export class PostgresPgVectorKnowledgeStore implements KnowledgeStorePort {
  constructor(
    private readonly config: {
      databaseUrl?: string;
      dimensions: number;
    },
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.databaseUrl);
  }

  async ensureSchema(): Promise<void> {
    if (!this.config.databaseUrl) {
      throw new Error("DATABASE_URL is required to compile knowledge");
    }

    const sql = postgres(this.config.databaseUrl, { max: 1 });
    const dimensions = safeVectorDimensions(this.config.dimensions);
    try {
      await sql`create extension if not exists vector`;
      await sql`
        create table if not exists voice_agent_documents (
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
      `;
      await sql.unsafe(`
        create table if not exists voice_agent_chunks (
          id text primary key,
          draft_id text not null,
          document_id text not null references voice_agent_documents(id) on delete cascade,
          ordinal integer not null,
          content text not null,
          embedding vector(${dimensions}),
          metadata jsonb not null default '{}'::jsonb,
          search tsvector generated always as (to_tsvector('simple', content)) stored,
          created_at timestamptz not null default now()
        )
      `);
      await sql`
        create index if not exists voice_agent_chunks_search_idx
        on voice_agent_chunks using gin (search)
      `;
      await sql.unsafe(`
        create index if not exists voice_agent_chunks_embedding_hnsw_idx
        on voice_agent_chunks using hnsw (embedding vector_cosine_ops)
      `);
    } finally {
      await sql.end();
    }
  }

  async compile(
    input: KnowledgeStoreCompileInput,
  ): Promise<KnowledgeStoreCompileResult> {
    if (!this.config.databaseUrl) {
      throw new Error("DATABASE_URL is required to compile knowledge");
    }
    await this.ensureSchema();

    const agentSchema = appliedAgentSchema(input.draft.databasePlan);
    if (agentSchema) return this.compileIntoAgentSchema(input, agentSchema);

    const sql = postgres(this.config.databaseUrl, { max: 1 });
    const embeddingById = new Map(
      input.embeddings.map((embedding) => [embedding.id, embedding]),
    );
    try {
      await sql.begin(async (tx) => {
        for (const document of input.documents) {
          await tx`
            insert into voice_agent_documents (
              id, draft_id, name, kind, mime_type, size_bytes, content, metadata
            )
            values (
              ${document.id},
              ${input.draft.id},
              ${document.name},
              ${document.kind},
              ${document.mimeType ?? null},
              ${document.sizeBytes ?? null},
              ${document.text ?? null},
              ${sql.json(toJsonValue(document.metadata ?? {}))}
            )
            on conflict (id) do update set
              draft_id = excluded.draft_id,
              name = excluded.name,
              kind = excluded.kind,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              content = excluded.content,
              metadata = excluded.metadata
          `;
        }

        for (const chunk of input.chunks) {
          const embedding = embeddingById.get(chunk.id);
          await tx`
            insert into voice_agent_chunks (
              id, draft_id, document_id, ordinal, content, embedding, metadata
            )
            values (
              ${chunk.id},
              ${input.draft.id},
              ${chunk.documentId},
              ${chunk.ordinal},
              ${chunk.text},
              ${vectorLiteral(embedding?.values ?? [])}::vector,
              ${sql.json(toJsonValue(chunk.metadata ?? {}))}
            )
            on conflict (id) do update set
              draft_id = excluded.draft_id,
              document_id = excluded.document_id,
              ordinal = excluded.ordinal,
              content = excluded.content,
              embedding = excluded.embedding,
              metadata = excluded.metadata
          `;
        }
      });
    } finally {
      await sql.end();
    }

    return {
      storeId: "postgres-pgvector",
      documentCount: input.documents.length,
      chunkCount: input.chunks.length,
      vectorIndexId: "voice_agent_chunks_embedding_hnsw_idx",
      lexicalIndexId: "voice_agent_chunks_search_idx",
    };
  }

  private async compileIntoAgentSchema(
    input: KnowledgeStoreCompileInput,
    schemaName: string,
  ): Promise<KnowledgeStoreCompileResult> {
    if (!this.config.databaseUrl) {
      throw new Error("DATABASE_URL is required to compile knowledge");
    }

    const sql = postgres(this.config.databaseUrl, { max: 1 });
    const embeddingById = new Map(
      input.embeddings.map((embedding) => [embedding.id, embedding]),
    );
    const schema = quoteIdentifier(schemaName);
    try {
      await sql.begin(async (tx) => {
        await ensureAgentKnowledgeTables(tx, schemaName, this.config.dimensions);
        for (const document of input.documents) {
          await tx.unsafe(
            `
              insert into ${schema}.knowledge_documents (
                id, draft_id, name, kind, mime_type, size_bytes, content, metadata
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
              on conflict (id) do update set
                draft_id = excluded.draft_id,
                name = excluded.name,
                kind = excluded.kind,
                mime_type = excluded.mime_type,
                size_bytes = excluded.size_bytes,
                content = excluded.content,
                metadata = excluded.metadata
            `,
            [
              document.id,
              input.draft.id,
              document.name,
              document.kind,
              document.mimeType ?? null,
              document.sizeBytes ?? null,
              document.text ?? null,
              JSON.stringify(toJsonValue(document.metadata ?? {})),
            ],
          );
        }

        for (const chunk of input.chunks) {
          const embedding = embeddingById.get(chunk.id);
          await tx.unsafe(
            `
              insert into ${schema}.knowledge_chunks (
                id, draft_id, document_id, ordinal, content, token_estimate,
                embedding, metadata
              )
              values ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb)
              on conflict (id) do update set
                draft_id = excluded.draft_id,
                document_id = excluded.document_id,
                ordinal = excluded.ordinal,
                content = excluded.content,
                token_estimate = excluded.token_estimate,
                embedding = excluded.embedding,
                metadata = excluded.metadata
            `,
            [
              chunk.id,
              input.draft.id,
              chunk.documentId,
              chunk.ordinal,
              chunk.text,
              chunk.tokenEstimate,
              vectorLiteral(embedding?.values ?? []),
              JSON.stringify(toJsonValue(chunk.metadata ?? {})),
            ],
          );
        }
      });
    } finally {
      await sql.end();
    }

    return {
      storeId: `postgres-pgvector:${schemaName}`,
      documentCount: input.documents.length,
      chunkCount: input.chunks.length,
      vectorIndexId: `${schemaName}.knowledge_chunks_embedding_hnsw_idx`,
      lexicalIndexId: `${schemaName}.knowledge_chunks_search_idx`,
    };
  }
}

function safeVectorDimensions(dimensions: number): number {
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 4096) {
    throw new Error("Vector dimensions must be an integer between 1 and 4096");
  }
  return dimensions;
}
