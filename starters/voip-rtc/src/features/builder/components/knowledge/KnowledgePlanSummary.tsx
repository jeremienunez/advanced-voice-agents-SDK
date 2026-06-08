import { Metric } from "../../../../components/ui/Metric.js";
import type { AgentBuildDraft } from "../../../../domain/builder/types.js";
import { KnowledgePipelineDiagram } from "./KnowledgePipelineDiagram.js";

export function KnowledgePlanSummary({ draft }: { draft: AgentBuildDraft }) {
  const plan = draft.knowledgePlan;
  if (!plan) return null;

  return (
    <div className="fade-in knowledge-section">
      <h3 className="knowledge-section-title">
        Plan de Connaissances RAG Généré
      </h3>
      <div className="strategySummary">
        <Metric label="Stratégie" value={plan.strategy} />
        <Metric
          label="Chunking"
          value={`${plan.chunking.method}, ${plan.chunking.targetTokens} tokens`}
        />
        <Metric
          label="Knowledge Graph"
          value={plan.kg.enabled ? "Activé" : "Désactivé"}
        />
      </div>
      <KnowledgePipelineDiagram plan={plan} />
      <div className="stack knowledge-reasons">
        <h3>Justification technique</h3>
        {plan.reasons.map((reason) => (
          <p key={reason} className="muted">
            • {reason}
          </p>
        ))}
      </div>
    </div>
  );
}
