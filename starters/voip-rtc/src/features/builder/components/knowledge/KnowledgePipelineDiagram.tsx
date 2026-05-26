import type { AgentBuildDraft } from "../../../../domain/builder.js";

export function KnowledgePipelineDiagram({
  plan,
}: {
  plan: NonNullable<AgentBuildDraft["knowledgePlan"]>;
}) {
  return (
    <div className="rag-flow-container">
      <h4 className="rag-flow-title">Schéma du Flux RAG Indexé</h4>
      <div className="rag-flow-nodes">
        <RagFlowNode eyebrow="Source" title="Documents" />
        <span className="rag-flow-arrow">→</span>
        <RagFlowNode
          eyebrow={`Chunker (${plan.chunking.method})`}
          highlight
          title={`${plan.chunking.targetTokens} tokens`}
        />
        <span className="rag-flow-arrow">→</span>
        <RagFlowNode eyebrow="Postgres Vector" title="HNSW Index" />
      </div>
    </div>
  );
}

function RagFlowNode({
  eyebrow,
  highlight = false,
  title,
}: {
  eyebrow: string;
  highlight?: boolean;
  title: string;
}) {
  return (
    <div className={`rag-flow-node ${highlight ? "highlight" : ""}`}>
      <span>{eyebrow}</span>
      <strong>{title}</strong>
    </div>
  );
}
