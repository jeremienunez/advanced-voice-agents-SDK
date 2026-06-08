import { Metric } from "../../../components/ui/Metric.js";
import type { CompiledAgentSummary } from "../../../domain/builder/types.js";

export function AgentCreatedOverlay({
  artifact,
  publicAgentName,
}: {
  artifact: CompiledAgentSummary;
  publicAgentName: string;
}) {
  return (
    <section className="agentCreatedOverlay" role="status" aria-live="assertive">
      <div className="createdCore" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="createdCopy">
        <p className="eyebrow">Agent Created</p>
        <strong>{publicAgentName}</strong>
        <p>RTC-ready spec compiled. Loading the active session in the lab.</p>
      </div>
      <div className="createdFacts">
        <Metric
          label="Agent"
          value={artifact.publicAgentName ?? publicAgentName}
        />
        <Metric
          label="Knowledge"
          value={
            artifact.knowledge
              ? `${artifact.knowledge.strategy} / ${artifact.knowledge.status}`
              : "not configured"
          }
        />
        <Metric label="Tools" value={artifact.selectedTools.join(", ") || "none"} />
      </div>
    </section>
  );
}
