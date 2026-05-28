import type { CypherGraphClientPort } from "./types.js";

type Neo4jAuth = {
  basic(username: string, password: string): unknown;
  none(): unknown;
};

type Neo4jDriver = {
  close(): Promise<void>;
  session(options?: Record<string, unknown>): Neo4jSession;
  verifyConnectivity?(): Promise<void>;
};

type Neo4jModule = {
  auth: Neo4jAuth;
  driver(uri: string, authToken: unknown): Neo4jDriver;
  session?: { WRITE?: string };
};

type Neo4jSession = {
  close(): Promise<void>;
  executeWrite?(work: (tx: Neo4jTransaction) => Promise<unknown>): Promise<unknown>;
  run(statement: string, parameters: Record<string, unknown>): Promise<unknown>;
  writeTransaction?(work: (tx: Neo4jTransaction) => Promise<unknown>): Promise<unknown>;
};

type Neo4jTransaction = {
  run(statement: string, parameters: Record<string, unknown>): Promise<unknown>;
};

export class DynamicCypherGraphClient implements CypherGraphClientPort {
  private driver?: Neo4jDriver;

  constructor(
    private readonly options: {
      password?: string;
      uri: string;
      username?: string;
    },
  ) {}

  async ensure(): Promise<void> {
    const driver = await this.connection();
    await driver.verifyConnectivity?.();
  }

  async run(statement: string, parameters: Record<string, unknown>): Promise<void> {
    const driver = await this.connection();
    const session = driver.session({ defaultAccessMode: "WRITE" });
    try {
      if (session.executeWrite) {
        await session.executeWrite((tx) => tx.run(statement, parameters));
        return;
      }
      if (session.writeTransaction) {
        await session.writeTransaction((tx) => tx.run(statement, parameters));
        return;
      }
      await session.run(statement, parameters);
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver?.close();
    this.driver = undefined;
  }

  private async connection(): Promise<Neo4jDriver> {
    if (!this.driver) {
      const neo4j = await loadNeo4jDriver();
      const authToken = this.options.username
        ? neo4j.auth.basic(this.options.username, this.options.password ?? "")
        : neo4j.auth.none();
      this.driver = neo4j.driver(this.options.uri, authToken);
    }
    return this.driver;
  }
}

async function loadNeo4jDriver(): Promise<Neo4jModule> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;
  const module = await dynamicImport("neo4j-driver");
  const candidate = module as { default?: unknown };
  return (candidate.default ?? module) as Neo4jModule;
}
