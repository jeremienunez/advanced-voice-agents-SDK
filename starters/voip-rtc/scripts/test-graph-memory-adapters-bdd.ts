import type { GraphMemoryUpsertInput } from "@voiceagentsdk/core/sdk";
import {
  createGraphMemoryStoreFromEnv,
  LocalGraphMemoryStore,
  MemgraphGraphMemoryStore,
  Neo4jGraphMemoryStore,
  PostgresGraphMemoryStore,
  type CypherGraphClientPort,
} from "../server/learning/graph-store.js";
import { assert, assertThrows } from "./shared/assertions.js";

const results = [
  scenarioFactoryKeepsLocalAndPostgresDefaults(),
  await scenarioNeo4jAdapterUsesParameterizedCypher(),
  await scenarioMemgraphAdapterUsesBoltCompatibleCypher(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioFactoryKeepsLocalAndPostgresDefaults(): string {
  const local = createGraphMemoryStoreFromEnv({});
  const postgres = createGraphMemoryStoreFromEnv({
    DATABASE_URL: "postgres://voiceagentsdk:voiceagentsdk@127.0.0.1:5432/voiceagentsdk",
  });

  assert(local instanceof LocalGraphMemoryStore, "graph factory must keep local dev default");
  assert(postgres instanceof PostgresGraphMemoryStore, "DATABASE_URL must keep Postgres graph default");
  assertThrows(
    () => createGraphMemoryStoreFromEnv({ AGENT_LEARNING_GRAPH_DRIVER: "neo4j" }),
    "NEO4J_URI or GRAPH_DATABASE_URL is required",
  );
  assertThrows(
    () => createGraphMemoryStoreFromEnv({ AGENT_LEARNING_GRAPH_DRIVER: "memgraph" }),
    "MEMGRAPH_URI or GRAPH_DATABASE_URL is required",
  );

  return "factory-keeps-local-and-postgres-defaults";
}

async function scenarioNeo4jAdapterUsesParameterizedCypher(): Promise<string> {
  const client = recordingCypherClient();
  const store = createGraphMemoryStoreFromEnv({
    AGENT_LEARNING_GRAPH_DRIVER: "neo4j",
    NEO4J_URI: "bolt://neo4j:7687",
    NEO4J_USERNAME: "neo4j",
    NEO4J_PASSWORD: "test-password",
  }, { cypherClient: client });

  assert(store instanceof Neo4jGraphMemoryStore, "neo4j driver must create the Neo4j adapter");
  const result = await store.upsert(graphInput());
  await store.close();

  assert(result.nodeCount === 2, "neo4j adapter must report written node count");
  assert(result.edgeCount === 1, "neo4j adapter must report written edge count");
  assert(client.ensureCalls === 1, "neo4j adapter must verify connectivity before writes");
  assert(client.closed, "neo4j adapter must close the injected client");
  assert(client.runs.length === 2, "neo4j adapter must batch nodes and edges separately");
  assert(
    client.runs[0].statement.includes("MERGE (node:AgentMemoryNode"),
    "node write must use Cypher MERGE",
  );
  assert(
    client.runs[1].statement.includes("MERGE (from)-[edge:AGENT_MEMORY_EDGE"),
    "edge write must use Cypher MERGE",
  );
  assert(
    !client.runs.map((run) => run.statement).join("\n").includes("agent-a"),
    "Cypher statements must keep graph data in parameters",
  );
  assert(client.runs[0].parameters.nodes.length === 2, "node batch must be parameterized");
  assert(client.runs[1].parameters.edges.length === 1, "edge batch must be parameterized");
  assert(
    client.runs[0].parameters.sourceSessionId === "session-graph-a",
    "source session must be a shared Cypher parameter",
  );

  return "neo4j-adapter-uses-parameterized-cypher";
}

async function scenarioMemgraphAdapterUsesBoltCompatibleCypher(): Promise<string> {
  const client = recordingCypherClient();
  const store = createGraphMemoryStoreFromEnv({
    AGENT_LEARNING_GRAPH_DRIVER: "memgraph",
    GRAPH_DATABASE_URL: "bolt://memgraph:7687",
    MEMGRAPH_USERNAME: "memgraph",
    MEMGRAPH_PASSWORD: "test-password",
  }, { cypherClient: client });

  assert(store instanceof MemgraphGraphMemoryStore, "memgraph driver must create the Memgraph adapter");
  const result = await store.upsert(graphInput());

  assert(result.nodeCount === 2, "memgraph adapter must report written node count");
  assert(result.edgeCount === 1, "memgraph adapter must report written edge count");
  assert(
    client.runs.every((run) => run.statement.includes("MERGE")),
    "memgraph adapter must stay on Bolt-compatible MERGE queries",
  );

  return "memgraph-adapter-uses-bolt-compatible-cypher";
}

function recordingCypherClient(): CypherGraphClientPort & {
  closed: boolean;
  ensureCalls: number;
  runs: Array<{ statement: string; parameters: Record<string, any> }>;
} {
  return {
    closed: false,
    ensureCalls: 0,
    runs: [],
    async ensure() {
      this.ensureCalls += 1;
    },
    async run(statement, parameters) {
      this.runs.push({ statement, parameters });
    },
    async close() {
      this.closed = true;
    },
  };
}

function graphInput(): GraphMemoryUpsertInput {
  return {
    tenantId: "tenant-a",
    agentId: "agent-a",
    userId: "user-a",
    sourceSessionId: "session-graph-a",
    nodes: [
      {
        id: "agent:agent-a",
        type: "agent",
        label: "Agent A",
        properties: { tier: "gold" },
      },
      {
        id: "user:tenant-a:user-a",
        type: "user",
        label: "User A",
        properties: { locale: "fr-FR" },
      },
    ],
    edges: [
      {
        id: "edge:agent-a:user-a",
        from: "agent:agent-a",
        to: "user:tenant-a:user-a",
        type: "served",
        properties: { confidence: 1 },
      },
    ],
  };
}
