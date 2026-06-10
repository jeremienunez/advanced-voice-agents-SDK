import { Button } from "../../components/ui/Button.js";
import { HologramBust } from "../../components/hologram/HologramBust.js";
import type { AgentBankItem } from "../../domain/builder/types.js";
import { formatDateTime } from "../../domain/shared/formatters.js";
import { readinessLabel } from "./agent-bank-view-model.js";

/* Embodiment mirrors status: a compiled agent stands fully formed,
   a draft hangs half-materialized — unfinished work asks to be resumed. */
function agentPresence(agent: AgentBankItem): number {
  if (agent.canRunRtc) return 1;
  if (agent.kind === "compiled") return 0.78;
  return 0.45;
}

export function AgentDetailPanel({
  agent,
  busy,
  onLoadRtc,
  onResumeBuilder,
  onRollback,
}: {
  agent: AgentBankItem | null;
  busy: boolean;
  onLoadRtc: (agent: AgentBankItem) => Promise<void>;
  onResumeBuilder: (agent: AgentBankItem) => Promise<void>;
  onRollback: (agent: AgentBankItem) => Promise<void>;
}) {
  if (!agent) {
    return (
      <aside className="agentDetailPanel empty">
        <div className="agentDetailStage" aria-hidden="true">
          <HologramBust presence={0.08} />
          <span className="agentDetailStageTag">awaiting selection</span>
        </div>
        <h2>No agent selected</h2>
        <p className="muted">
          Select an agent from the library to inspect readiness, assets, and runtime actions.
        </p>
      </aside>
    );
  }

  const knowledgeSummary = agent.knowledge
    ? `${agent.knowledge.strategy ?? "Unplanned"} · ${agent.knowledge.documentCount ?? 0} documents`
    : "Not configured";
  const databaseSummary = agent.database
    ? `${agent.database.schemaName} · ${agent.database.status}`
    : "Not provisioned";

  return (
    <aside className="agentDetailPanel">
      <div className="agentDetailStage" aria-hidden="true">
        <HologramBust presence={agentPresence(agent)} />
        <span className="agentDetailStageTag">{readinessLabel(agent)}</span>
      </div>
      <header>
        <h2>{agent.publicAgentName}</h2>
        <p>{agent.intent}</p>
      </header>

      <dl className="agentDetailStats">
        <div>
          <dt>Kind</dt>
          <dd>{agent.kind}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{agent.status}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>v{agent.evolution?.version ?? (agent.kind === "compiled" ? 1 : 0)}</dd>
        </div>
        <div>
          <dt>Prompt</dt>
          <dd>{agent.promptChars.toLocaleString()} chars</dd>
        </div>
        <div>
          <dt>Knowledge</dt>
          <dd>{knowledgeSummary}</dd>
        </div>
        <div>
          <dt>Tools</dt>
          <dd>{agent.selectedTools.length} enabled</dd>
        </div>
      </dl>

      <section className="agentDetailSection">
        <h3>Learning</h3>
        <p>
          {agent.evolution?.lastLearningRun
            ? `${agent.evolution.lastLearningRun.status} · ${formatDateTime(agent.evolution.lastLearningRun.at)}`
            : "No learning runs recorded."}
        </p>
      </section>

      <section className="agentDetailSection">
        <h3>Database</h3>
        <p>{databaseSummary}</p>
        {agent.database?.appliedAt ? (
          <small>Applied {formatDateTime(agent.database.appliedAt)}</small>
        ) : null}
      </section>

      <footer className="agentDetailActions">
        <Button
          onClick={() => void onLoadRtc(agent)}
          disabled={busy || !agent.canRunRtc}
          variant="primary"
        >
          {busy ? "Loading..." : "Run RTC"}
        </Button>
        <Button onClick={() => void onResumeBuilder(agent)} disabled={busy}>
          {busy ? "Opening..." : "Resume Build"}
        </Button>
        <Button
          onClick={() => void onRollback(agent)}
          disabled={busy || !agent.evolution?.rollbackAvailable}
        >
          {busy ? "Rolling back..." : "Rollback"}
        </Button>
      </footer>
    </aside>
  );
}
