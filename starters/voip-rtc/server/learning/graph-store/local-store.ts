import type {
  GraphMemoryEdge,
  GraphMemoryNode,
  GraphMemoryStorePort,
  GraphMemoryUpsertInput,
} from "@voiceagentsdk/core/sdk";

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
