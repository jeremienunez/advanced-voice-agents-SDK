import type { AgentRxDiagnosticReport } from "@voiceagentsdk/core/sdk";
import "../../styles/components/diagnostics/AgentRxPanel.css";

export function AgentRxPanel({
  report,
}: {
  report: AgentRxDiagnosticReport;
}) {
  const failure = report.criticalFailure;
  return (
    <section className={`agentrx-panel agentrx-${report.status}`}>
      <div className="agentrx-header">
        <div>
          <span className="agentrx-eyebrow">AGENTRX trajectory diagnostics</span>
          <h3>Failure attribution harness</h3>
        </div>
        <strong>{report.status}</strong>
      </div>

      <div className="agentrx-summary">
        <span>{report.constraints.length} constraints</span>
        <span>{report.violations.length} violations</span>
        <span>{report.taxonomyVersion ?? "taxonomy pending"}</span>
      </div>

      <div className="agentrx-critical">
        {failure ? (
          <>
            <span>Critical step {failure.stepIndex}</span>
            <strong>{failure.category}</strong>
            <p>{failure.evidence}</p>
          </>
        ) : (
          <p>No unrecovered violation detected. Continue the builder flow.</p>
        )}
      </div>

      <ol className="agentrx-trajectory">
        {report.trajectory.map((step) => (
          <li key={`${step.index}-${step.action}`} data-status={step.status}>
            <span>{step.index}</span>
            <div>
              <strong>{step.phase}</strong>
              <small>{step.actor}.{step.action}</small>
            </div>
          </li>
        ))}
      </ol>

      {report.recommendation ? (
        <p className="agentrx-recommendation">{report.recommendation}</p>
      ) : null}
    </section>
  );
}
