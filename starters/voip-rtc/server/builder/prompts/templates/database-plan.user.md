<task>
Create a DatabaseBuildPlan JSON for one isolated voice-agent knowledge DB.
</task>

<rules>
- Use exactly schemaName={{schemaName}}.
- Use databaseProvider `postgres-pgvector`.
- Use PostgreSQL, pgvector vector(1024), Postgres FTS, HNSW cosine.
- Allowed SQL only: CREATE EXTENSION vector, CREATE SCHEMA, CREATE TABLE, CREATE INDEX.
- No DROP, TRUNCATE, ALTER SYSTEM, functions, triggers, COPY, grants, DML, dynamic SQL, or cross-schema objects.
- Keep SQL to 6 statements: extension, schema, documents table, chunks table, FTS index, HNSW index.
- Statements must be idempotent with `if not exists` where PostgreSQL supports it.
- Tables must support source documents, chunks, metadata, lexical search, embeddings, and timestamps.
- Repository plan must be read-only for runtime retrieval: `get`, `list`, `search`.
- Keep risk notes concrete and operational.
</rules>

<output_contract>
Return this exact compact shape:
{
  "id": "string",
  "status": "planned",
  "databaseProvider": "postgres-pgvector",
  "schemaName": "{{schemaName}}",
  "sqlMigration": "string",
  "statements": [],
  "tables": [],
  "indexes": [],
  "vectorization": {},
  "kg": {},
  "repositories": {},
  "reasons": [],
  "risks": [],
  "validationErrors": []
}
</output_contract>

<draft_identity_json>
{{draftIdentityJson}}
</draft_identity_json>

<knowledge_strategy>
{{knowledgeStrategy}}
</knowledge_strategy>

<documents_json>
{{documentSummaryJson}}
</documents_json>
