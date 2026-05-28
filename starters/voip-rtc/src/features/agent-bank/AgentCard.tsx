import { Button } from "../../components/ui/Button.js";
import type { AgentBankItem } from "../../domain/builder.js";
import { formatDateTime } from "../../domain/formatters.js";
import { readinessLabel } from "./agent-bank-view-model.js";
import "./AgentCard.css";

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
          <h2 className="agent-title">
            {agent.publicAgentName}
          </h2>
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

      <div className="agent-metadata-grid">
        <span className="agent-meta-label">LLM / Model</span>
        <span className="agent-meta-value">{agent.kind}</span>

        <span className="agent-meta-label">RAG knowledge</span>
        <span className="agent-meta-value truncate">
          {agent.knowledge?.strategy ? agent.knowledge.strategy : "Unplanned"}
        </span>

        <span className="agent-meta-label">Documents</span>
        <span className="agent-meta-value">{agent.knowledge?.documentCount ?? 0} files</span>

        <span className="agent-meta-label">System prompt</span>
        <span className="agent-meta-value">{agent.promptChars} chars</span>

        <span className="agent-meta-label">Enabled tools</span>
        <span className="agent-meta-value">{agent.selectedTools.length} tools</span>

        <span className="agent-meta-label">Agent version</span>
        <span className="agent-meta-value">v{agent.evolution?.version ?? (isCompiled ? 1 : 0)}</span>

        <span className="agent-meta-label">Last learning</span>
        <span className="agent-meta-value">
          {agent.evolution?.lastLearningRun
            ? `${agent.evolution.lastLearningRun.status} · ${formatDateTime(agent.evolution.lastLearningRun.at)}`
            : "None"}
        </span>
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
