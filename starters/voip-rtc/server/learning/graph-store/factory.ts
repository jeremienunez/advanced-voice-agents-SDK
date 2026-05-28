import type { GraphMemoryStorePort } from "@voiceagentsdk/core/sdk";
import {
  MemgraphGraphMemoryStore,
  Neo4jGraphMemoryStore,
} from "./cypher-store.js";
import { LocalGraphMemoryStore } from "./local-store.js";
import { PostgresGraphMemoryStore } from "./postgres-store.js";
import type {
  GraphMemoryDriver,
  GraphMemoryStoreFactoryOptions,
} from "./types.js";

export function createGraphMemoryStoreFromEnv(
  env: Record<string, string | undefined> = Bun.env,
  options: GraphMemoryStoreFactoryOptions = {},
): GraphMemoryStorePort {
  const driver = graphDriver(env);
  if (driver === "local") return new LocalGraphMemoryStore();
  if (driver === "postgres") {
    return new PostgresGraphMemoryStore({ databaseUrl: requiredDatabaseUrl(env) });
  }
  if (driver === "neo4j") {
    return new Neo4jGraphMemoryStore({
      client: options.cypherClient,
      password: env.NEO4J_PASSWORD ?? env.GRAPH_DATABASE_PASSWORD,
      uri: requiredGraphUri(env, ["NEO4J_URI", "GRAPH_DATABASE_URL"]),
      username: env.NEO4J_USERNAME ?? env.GRAPH_DATABASE_USERNAME,
    });
  }
  if (driver === "memgraph") {
    return new MemgraphGraphMemoryStore({
      client: options.cypherClient,
      password: env.MEMGRAPH_PASSWORD ?? env.GRAPH_DATABASE_PASSWORD,
      uri: requiredGraphUri(env, ["MEMGRAPH_URI", "GRAPH_DATABASE_URL"]),
      username: env.MEMGRAPH_USERNAME ?? env.GRAPH_DATABASE_USERNAME,
    });
  }
  if (env.DATABASE_URL) return new PostgresGraphMemoryStore({ databaseUrl: env.DATABASE_URL });
  return new LocalGraphMemoryStore();
}

function graphDriver(env: Record<string, string | undefined>): GraphMemoryDriver | undefined {
  const value = env.AGENT_LEARNING_GRAPH_DRIVER;
  if (value === "local" || value === "postgres" || value === "neo4j" || value === "memgraph") {
    return value;
  }
  return undefined;
}

function requiredDatabaseUrl(env: Record<string, string | undefined>): string {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for postgres graph memory driver");
  return databaseUrl;
}

function requiredGraphUri(
  env: Record<string, string | undefined>,
  keys: [string, string],
): string {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  throw new Error(`${keys[0]} or ${keys[1]} is required for graph memory driver`);
}
