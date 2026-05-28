export type GraphMemoryDriver = "local" | "postgres" | "neo4j" | "memgraph";

export interface CypherGraphClientPort {
  ensure?(): Promise<void>;
  run(statement: string, parameters: Record<string, unknown>): Promise<void>;
  close?(): Promise<void>;
}

export interface GraphMemoryStoreFactoryOptions {
  cypherClient?: CypherGraphClientPort;
}

export interface CypherGraphStoreOptions {
  client?: CypherGraphClientPort;
  password?: string;
  provider: "neo4j" | "memgraph";
  uri: string;
  username?: string;
}
