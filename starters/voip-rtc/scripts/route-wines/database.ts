import postgres from "postgres";
import type { JsonRecord } from "./types.js";

export async function probeDatabase(
  databaseUrl: string | undefined,
  schemaName: string,
): Promise<JsonRecord> {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for db probe");
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const schema = quoteIdentifier(schemaName);
    const tableRows = await sql`
      select count(*)::int as count
      from information_schema.tables
      where table_schema = ${schemaName}
    `;
    const documentRows = await sql.unsafe(
      `select count(*)::int as count from ${schema}.knowledge_documents`,
    );
    const chunkRows = await sql.unsafe(
      `select count(*)::int as count from ${schema}.knowledge_chunks`,
    );
    const vectorRows = await sql.unsafe(
      `select count(*)::int as count from ${schema}.knowledge_chunks where embedding is not null`,
    );
    return {
      schemaName,
      tableCount: tableRows[0]?.count,
      documentCount: documentRows[0]?.count,
      chunkCount: chunkRows[0]?.count,
      vectorizedChunkCount: vectorRows[0]?.count,
    };
  } finally {
    await sql.end();
  }
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}
