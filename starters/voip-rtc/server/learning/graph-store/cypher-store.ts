import type {
  GraphMemoryStorePort,
  GraphMemoryUpsertInput,
} from "@voiceagentsdk/core/sdk";
import { DynamicCypherGraphClient } from "./cypher-client.js";
import type {
  CypherGraphClientPort,
  CypherGraphStoreOptions,
} from "./types.js";

const nodeUpsertCypher = `
UNWIND $nodes AS item
MERGE (node:AgentMemoryNode {id: item.id})
SET node.type = item.type,
    node.label = item.label,
    node.properties = item.properties,
    node.tenantId = $tenantId,
    node.agentId = $agentId,
    node.userId = $userId,
    node.sourceSessionId = $sourceSessionId,
    node.updatedAt = datetime()
`;

const edgeUpsertCypher = `
UNWIND $edges AS item
MATCH (from:AgentMemoryNode {id: item.from})
MATCH (to:AgentMemoryNode {id: item.to})
MERGE (from)-[edge:AGENT_MEMORY_EDGE {id: item.id}]->(to)
SET edge.type = item.type,
    edge.properties = item.properties,
    edge.tenantId = $tenantId,
    edge.agentId = $agentId,
    edge.userId = $userId,
    edge.sourceSessionId = $sourceSessionId,
    edge.updatedAt = datetime()
`;

export class CypherGraphMemoryStore implements GraphMemoryStorePort {
  private client?: CypherGraphClientPort;
  private ensured = false;

  constructor(private readonly options: CypherGraphStoreOptions) {}

  isConfigured(): boolean {
    return Boolean(this.options.uri);
  }

  async ensure(): Promise<void> {
    if (this.ensured) return;
    await this.connection().ensure?.();
    this.ensured = true;
  }

  async upsert(
    input: GraphMemoryUpsertInput,
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    await this.ensure();
    const parameters = sharedParameters(input);
    if (input.nodes.length) {
      await this.connection().run(nodeUpsertCypher, {
        ...parameters,
        nodes: input.nodes.map((node) => ({
          id: node.id,
          label: node.label,
          properties: node.properties ?? {},
          type: node.type,
        })),
      });
    }
    if (input.edges.length) {
      await this.connection().run(edgeUpsertCypher, {
        ...parameters,
        edges: input.edges.map((edge) => ({
          from: edge.from,
          id: edge.id,
          properties: edge.properties ?? {},
          to: edge.to,
          type: edge.type,
        })),
      });
    }
    return { nodeCount: input.nodes.length, edgeCount: input.edges.length };
  }

  async close(): Promise<void> {
    await this.client?.close?.();
  }

  private connection(): CypherGraphClientPort {
    if (!this.client) {
      this.client = this.options.client ?? new DynamicCypherGraphClient({
        password: this.options.password,
        uri: this.options.uri,
        username: this.options.username,
      });
    }
    return this.client;
  }
}

export class Neo4jGraphMemoryStore implements GraphMemoryStorePort {
  private readonly store: CypherGraphMemoryStore;

  constructor(options: Omit<CypherGraphStoreOptions, "provider">) {
    this.store = new CypherGraphMemoryStore({ ...options, provider: "neo4j" });
  }

  isConfigured(): boolean {
    return this.store.isConfigured();
  }

  ensure(): Promise<void> {
    return this.store.ensure();
  }

  upsert(input: GraphMemoryUpsertInput): Promise<{ nodeCount: number; edgeCount: number }> {
    return this.store.upsert(input);
  }

  close(): Promise<void> {
    return this.store.close();
  }
}

export class MemgraphGraphMemoryStore implements GraphMemoryStorePort {
  private readonly store: CypherGraphMemoryStore;

  constructor(options: Omit<CypherGraphStoreOptions, "provider">) {
    this.store = new CypherGraphMemoryStore({ ...options, provider: "memgraph" });
  }

  isConfigured(): boolean {
    return this.store.isConfigured();
  }

  ensure(): Promise<void> {
    return this.store.ensure();
  }

  upsert(input: GraphMemoryUpsertInput): Promise<{ nodeCount: number; edgeCount: number }> {
    return this.store.upsert(input);
  }

  close(): Promise<void> {
    return this.store.close();
  }
}

function sharedParameters(input: GraphMemoryUpsertInput): Record<string, unknown> {
  return {
    agentId: input.agentId ?? null,
    sourceSessionId: input.sourceSessionId,
    tenantId: input.tenantId ?? null,
    userId: input.userId ?? null,
  };
}
