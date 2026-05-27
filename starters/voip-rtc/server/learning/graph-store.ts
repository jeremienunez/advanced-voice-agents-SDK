import type {
  GraphMemoryEdge,
  GraphMemoryNode,
  GraphMemoryStorePort,
  GraphMemoryUpsertInput,
} from "@voiceagentsdk/core/sdk";
import postgres from "postgres";

export class LocalGraphMemoryStore implements GraphMemoryStorePort {
  private readonly nodes = new Map<string, GraphMemoryNode>();
  private readonly edges = new Map<string, GraphMemoryEdge>();
  private ensured = false;

  isConfigured(): boolean {
    return true;
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.size;
  }

  ensure(): void {
    this.ensured = true;
  }

  async upsert(
    input: GraphMemoryUpsertInput,
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    if (!this.ensured) this.ensure();
    for (const node of input.nodes) this.nodes.set(node.id, node);
    for (const edge of input.edges) this.edges.set(edge.id, edge);
    return { nodeCount: input.nodes.length, edgeCount: input.edges.length };
  }
}

export class PostgresGraphMemoryStore implements GraphMemoryStorePort {
  constructor(
    private readonly options: {
      databaseUrl?: string;
    },
  ) {}

  isConfigured(): boolean {
    return Boolean(this.options.databaseUrl);
  }

  async ensure(): Promise<void> {
    if (!this.options.databaseUrl) return;
    const sql = postgres(this.options.databaseUrl, { max: 1 });
    try {
      await sql`
        create table if not exists agent_graph_nodes (
          id text primary key,
          tenant_id text,
          agent_id text,
          user_id text,
          type text not null,
          label text not null,
          properties jsonb not null default '{}'::jsonb,
          source_session_id text not null,
          updated_at timestamptz not null default now()
        )
      `;
      await sql`
        create table if not exists agent_graph_edges (
          id text primary key,
          tenant_id text,
          agent_id text,
          user_id text,
          from_node text not null,
          to_node text not null,
          type text not null,
          properties jsonb not null default '{}'::jsonb,
          source_session_id text not null,
          updated_at timestamptz not null default now()
        )
      `;
    } finally {
      await sql.end();
    }
  }

  async upsert(
    input: GraphMemoryUpsertInput,
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    if (!this.options.databaseUrl) {
      return { nodeCount: input.nodes.length, edgeCount: input.edges.length };
    }
    await this.ensure();
    const sql = postgres(this.options.databaseUrl, { max: 1 });
    try {
      await sql.begin(async (tx) => {
        for (const node of input.nodes) {
          await tx`
            insert into agent_graph_nodes (
              id, tenant_id, agent_id, user_id, type, label, properties,
              source_session_id, updated_at
            )
            values (
              ${node.id},
              ${input.tenantId ?? null},
              ${input.agentId ?? null},
              ${input.userId ?? null},
              ${node.type},
              ${node.label},
              ${tx.json(node.properties ?? {})},
              ${input.sourceSessionId},
              now()
            )
            on conflict (id) do update set
              tenant_id = excluded.tenant_id,
              agent_id = excluded.agent_id,
              user_id = excluded.user_id,
              type = excluded.type,
              label = excluded.label,
              properties = excluded.properties,
              source_session_id = excluded.source_session_id,
              updated_at = now()
          `;
        }
        for (const edge of input.edges) {
          await tx`
            insert into agent_graph_edges (
              id, tenant_id, agent_id, user_id, from_node, to_node, type,
              properties, source_session_id, updated_at
            )
            values (
              ${edge.id},
              ${input.tenantId ?? null},
              ${input.agentId ?? null},
              ${input.userId ?? null},
              ${edge.from},
              ${edge.to},
              ${edge.type},
              ${tx.json(edge.properties ?? {})},
              ${input.sourceSessionId},
              now()
            )
            on conflict (id) do update set
              tenant_id = excluded.tenant_id,
              agent_id = excluded.agent_id,
              user_id = excluded.user_id,
              from_node = excluded.from_node,
              to_node = excluded.to_node,
              type = excluded.type,
              properties = excluded.properties,
              source_session_id = excluded.source_session_id,
              updated_at = now()
          `;
        }
      });
    } finally {
      await sql.end();
    }
    return { nodeCount: input.nodes.length, edgeCount: input.edges.length };
  }
}
