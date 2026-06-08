import { Metric } from "../../../../components/ui/Metric.js";
import type { KnowledgeResearchResult } from "../../../../domain/builder/knowledge.js";
import { formatUsd } from "../../../../domain/shared/formatters.js";

export function ResearchReportSummary({
  report,
}: {
  report: KnowledgeResearchResult;
}) {
  return (
    <div className="fade-in knowledge-section">
      <h3 className="knowledge-section-title">Rapport de Recherche Web Autonome</h3>
      <div className="strategySummary">
        <Metric label="Recherche" value={report.status} />
        <Metric
          label="Consommation"
          value={`${report.spend.cycles}/${report.budget.maxCycles} cycles, ${report.spend.sources}/${report.budget.maxSources} sources`}
        />
        <Metric
          label="Coût Estimé"
          value={`${report.spend.estimatedTokens} tokens, ${formatUsd(report.spend.estimatedCostUsd)}`}
        />
        <Metric label="Raison d'arrêt" value={report.stopReason ?? "Terminé"} />
      </div>
      <div className="research-checkpoints">
        {report.cycles.slice(0, 4).map((cycle) => (
          <article key={cycle.id}>
            <strong>{cycle.objective}</strong>
            <span>
              {cycle.status} · {cycle.sourceCount} sources · {cycle.checkpoints?.length ?? 0} checkpoints
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}
