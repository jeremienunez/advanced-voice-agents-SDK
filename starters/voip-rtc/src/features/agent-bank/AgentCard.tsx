import { Button } from "../../components/ui/Button.js";
import type { AgentBankItem } from "../../domain/builder/types.js";
import { formatDateTime } from "../../domain/shared/formatters.js";
import { readinessLabel } from "./agent-bank-view-model.js";
import "./styles/AgentCard.css";

export function AgentCard({
  agent,
  active,
  busy,
  busyDraftId,
  onSelect,
  onLoadRtc,
  onResumeBuilder,
  onRollback,
}: {
  agent: AgentBankItem;
  active: boolean;
  busy: boolean;
  busyDraftId: string | null;
  onSelect: (draftId: string) => void;
  onLoadRtc: (agent: AgentBankItem) => Promise<void>;
  onResumeBuilder: (agent: AgentBankItem) => Promise<void>;
  onRollback: (agent: AgentBankItem) => Promise<void>;
}) {
  const isCompiled = agent.status === "compiled" || agent.canRunRtc;

  return (
    <article className={active ? "agentCard active" : "agentCard"}>
      <button
        aria-pressed={active}
        className="agentCardSelect"
        type="button"
        onClick={() => onSelect(agent.draftId)}
      >
        <span>{agent.publicAgentName}</span>
        <small>{readinessLabel(agent)}</small>
      </button>

      <div className="agent-header">
        <div>
          <span className={`agent-badge ${isCompiled ? "compiled" : "draft"}`}>
            {isCompiled ? "Compiled" : "Draft"}
          </span>
        </div>
        {agent.active && (
          <span className="agent-badge activeBadge">
            Active
          </span>
        )}
      </div>

      <p className="agentIntent">
        {agent.intent}
      </p>

      <div className="agent-meta-badges">
        <div className="meta-badge">
          <span className="meta-label">Model</span>
          <span className="meta-value">{agent.kind}</span>
        </div>
        <div className="meta-badge">
          <span className="meta-label">Version</span>
          <span className="meta-value">v{agent.evolution?.version ?? (isCompiled ? 1 : 0)}</span>
        </div>
        <div className="meta-badge">
          <span className="meta-label">Tools</span>
          <span className="meta-value">{agent.selectedTools.length} tools</span>
        </div>
      </div>

      <div className="agentUpdatedAt">
        <span>Updated: {formatDateTime(agent.updatedAt)}</span>
      </div>

      <div className="agentActions">
        {agent.canRunRtc && (
          <Button
            className="agentActionButton"
            onClick={() => void onLoadRtc(agent)}
            disabled={busy}
            variant="primary"
          >
            {busyDraftId === agent.draftId ? "Loading..." : "Run RTC"}
          </Button>
        )}
        <Button
          className="agentActionButton"
          onClick={() => void onResumeBuilder(agent)}
          disabled={busy}
        >
          {busyDraftId === agent.draftId ? "Opening..." : "Resume Build"}
        </Button>
        {agent.evolution?.rollbackAvailable ? (
          <Button
            className="agentActionButton"
            onClick={() => void onRollback(agent)}
            disabled={busy}
          >
            {busyDraftId === agent.draftId ? "Rolling back..." : "Rollback"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
