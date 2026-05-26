import { Button } from "../../components/ui/Button.js";
import type { AgentBankItem } from "../../domain/builder.js";
import { formatDateTime } from "../../domain/formatters.js";
import "./AgentCard.css";

export function AgentCard({
  agent,
  busyDraftId,
  onLoadRtc,
  onResumeBuilder,
}: {
  agent: AgentBankItem;
  busyDraftId: string | null;
  onLoadRtc: (agent: AgentBankItem) => Promise<void>;
  onResumeBuilder: (agent: AgentBankItem) => Promise<void>;
}) {
  const isCompiled = agent.status === "compiled" || agent.canRunRtc;

  return (
    <article className="agent-profile-card">
      <div className="agent-header">
        <div>
          <span className={`agent-badge ${isCompiled ? "compiled" : "draft"}`}>
            {isCompiled ? "Compilé" : "Brouillon"}
          </span>
          <h2 className="agent-title">
            {agent.publicAgentName}
          </h2>
        </div>
        {agent.active && (
          <span className="agent-badge" style={{ background: 'var(--google-blue-light)', color: 'var(--google-blue)' }}>
            Actif
          </span>
        )}
      </div>

      <p className="agentIntent" style={{ color: 'var(--slate-500)', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
        {agent.intent}
      </p>

      <div className="agent-metadata-grid">
        <span className="agent-meta-label">LLM / Modèle</span>
        <span className="agent-meta-value">{agent.kind}</span>

        <span className="agent-meta-label">Connaissances RAG</span>
        <span className="agent-meta-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.knowledge?.strategy ? agent.knowledge.strategy : "Non planifié"}
        </span>

        <span className="agent-meta-label">Documents</span>
        <span className="agent-meta-value">{agent.knowledge?.documentCount ?? 0} fichiers</span>

        <span className="agent-meta-label">Prompt Système</span>
        <span className="agent-meta-value">{agent.promptChars} caract.</span>

        <span className="agent-meta-label">Outils Activés</span>
        <span className="agent-meta-value">{agent.selectedTools.length} outils</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--slate-500)' }}>
        <span>Mis à jour le : {formatDateTime(agent.updatedAt)}</span>
      </div>

      <div className="agentActions">
        {agent.canRunRtc && (
          <Button
            className="agentActionButton"
            onClick={() => void onLoadRtc(agent)}
            disabled={busyDraftId === agent.draftId}
            variant="primary"
          >
            {busyDraftId === agent.draftId ? "Chargement..." : "Lancer VoIP RTC"}
          </Button>
        )}
        <Button
          className="agentActionButton"
          onClick={() => void onResumeBuilder(agent)}
          disabled={busyDraftId === agent.draftId}
        >
          {busyDraftId === agent.draftId ? "Ouverture..." : "Ouvrir Éditeur"}
        </Button>
      </div>
    </article>
  );
}
