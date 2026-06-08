import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

type JsonRecord = Record<string, unknown>;

const root = new URL("../../../", import.meta.url).pathname;
const starterRoot = new URL("../", import.meta.url).pathname;

const env = {
  ...(await readDotEnv(new URL("../../../.env", import.meta.url))),
  ...(await readDotEnv(new URL("../.env", import.meta.url))),
  ...(await readDotEnv(new URL("../.env.local", import.meta.url))),
  ...process.env,
};

const databaseUrl = env.DATABASE_URL;
if (!databaseUrl) {
  fail("DATABASE_URL is required. Run pnpm --filter @voiceagentsdk/starter-voip-rtc db:start first.");
}

const session = readJson(join(starterRoot, ".builder-state", "session.json"));
const drafts = readJson(join(starterRoot, ".builder-state", "drafts.json"));
const activeDraftId = readString(session, "activeDraftId");
const draftList = readArray(drafts).map(asRecord);

const activeDraft = draftList.find((item) => {
  return readString(asRecord(item), "id") === activeDraftId;
});
const draft = isCompiledKnowledgeDraft(activeDraft)
  ? activeDraft
  : draftList.filter(isCompiledKnowledgeDraft).sort(sortDraftsByActivity)[0];
if (!draft) {
  fail("No compiled knowledge draft found. Run the route-wines harness first.");
}

const targetDraftId = readString(draft, "id");

const compiled = asRecord(asRecord(draft).compiled);
if (!compiled.draftId) fail(`Target draft is not compiled: ${targetDraftId}`);

const knowledge = asRecord(compiled.knowledge);
if (knowledge.status !== "compiled") {
  fail(`Knowledge is not compiled for ${targetDraftId}`);
}

const storeId = readString(knowledge, "storeId");
const schemaName = storeId.includes(":") ? storeId.split(":").at(-1) : "";
if (!schemaName) fail(`Cannot derive schema from storeId: ${storeId}`);

const sql = postgres(databaseUrl, { max: 1 });
try {
  const schema = quoteIdentifier(schemaName);
  const extensionRows = await sql`
    select count(*)::int as count
    from pg_extension
    where extname = 'vector'
  `;
  const tableRows = await sql`
    select count(*)::int as count
    from information_schema.tables
    where table_schema = ${schemaName}
  `;
  const indexRows = await sql`
    select indexname
    from pg_indexes
    where schemaname = ${schemaName}
    order by indexname
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
  const ftsRows = await sql.unsafe(
    `select count(*)::int as count from ${schema}.knowledge_chunks where search is not null`,
  );

  const result = {
    status: "ok",
    root,
    activeDraftId,
    targetDraftId,
    schemaName,
    vectorExtension: Number(extensionRows[0]?.count ?? 0) > 0,
    tableCount: Number(tableRows[0]?.count ?? 0),
    indexes: indexRows.map((row) => row.indexname),
    documentCount: Number(documentRows[0]?.count ?? 0),
    chunkCount: Number(chunkRows[0]?.count ?? 0),
    vectorizedChunkCount: Number(vectorRows[0]?.count ?? 0),
    ftsChunkCount: Number(ftsRows[0]?.count ?? 0),
  };

  assert(result.vectorExtension, "pgvector extension is missing");
  assert(result.tableCount >= 2, "knowledge schema tables are missing");
  assert(result.documentCount >= 1, "no knowledge documents stored");
  assert(result.chunkCount >= 1, "no knowledge chunks stored");
  assert(
    result.vectorizedChunkCount === result.chunkCount,
    "not all chunks are vectorized",
  );
  assert(result.ftsChunkCount === result.chunkCount, "FTS search column is incomplete");
  assert(
    result.indexes.some((name) => name.includes("embedding_hnsw")),
    "HNSW vector index is missing",
  );
  assert(
    result.indexes.some((name) => name.includes("search")),
    "FTS index is missing",
  );

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end();
}

async function readDotEnv(url: URL): Promise<Record<string, string>> {
  const file = Bun.file(url);
  if (!(await file.exists())) return {};
  const envFile: Record<string, string> = {};
  const text = await file.text();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    envFile[key] = value.replace(/^["']|["']$/g, "");
  }
  return envFile;
}

function readJson(path: string): unknown {
  if (!existsSync(path)) fail(`Missing file: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : {};
}

function readString(value: unknown, key: string): string {
  const item = asRecord(value)[key];
  return typeof item === "string" ? item : "";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isCompiledKnowledgeDraft(value: unknown): value is JsonRecord {
  const draft = asRecord(value);
  const compiled = asRecord(draft.compiled);
  const knowledge = asRecord(compiled.knowledge);
  return Boolean(compiled.draftId) && knowledge.status === "compiled";
}

function sortDraftsByActivity(left: JsonRecord, right: JsonRecord): number {
  const leftCompiled = asRecord(left.compiled);
  const rightCompiled = asRecord(right.compiled);
  const leftTime = Date.parse(
    readString(leftCompiled, "createdAt") || readString(left, "updatedAt"),
  );
  const rightTime = Date.parse(
    readString(rightCompiled, "createdAt") || readString(right, "updatedAt"),
  );
  return (rightTime || 0) - (leftTime || 0);
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(identifier)) {
    fail(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}
