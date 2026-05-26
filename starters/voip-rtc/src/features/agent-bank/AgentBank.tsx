import { Button } from "../../components/ui/Button.js";
import { Metric } from "../../components/ui/Metric.js";
import { Panel } from "../../components/ui/Panel.js";
import type {
  AgentBuildDraft,
  CompiledAgentSummary,
} from "../../domain/builder.js";
import { useAgentBank } from "../../hooks/useAgentBank.js";
import { AgentCard } from "./AgentCard.js";
import "./AgentBank.css";

export function AgentBank({
  apiBase,
  refreshKey,
  onLoadRtc,
  onResumeBuilder,
}: {
  apiBase: string;
  refreshKey: number;
  onLoadRtc: (artifact: CompiledAgentSummary) => void;
  onResumeBuilder: (draft: AgentBuildDraft) => void;
}) {
  const bank = useAgentBank({
    apiBase,
    refreshKey,
    onLoadRtc,
    onResumeBuilder,
  });

  return (
    <>
      <section className="topbar agentsTopbar">
        <div>
          <p className="eyebrow">Mémoire du SDK</p>
          <h1>Banque d'Agents</h1>
          <p className="muted">
            Relancez vos agents vocaux compilés dans le Lab RTC ou reprenez l'édition de vos brouillons.
          </p>
        </div>
        <div className="bankStats">
          <Metric label="Agents Compilés" value={String(bank.compiledCount)} />
          <Metric label="Brouillons" value={String(bank.draftCount)} />
        </div>
      </section>

      <section className="agentBankToolbar">
        <Button
          disabled={bank.loading}
          variant="primary"
          onClick={() => void bank.loadAgents()}
        >
          {bank.loading ? "Actualisation..." : "Actualiser la liste"}
        </Button>
        {bank.bank?.activeDraftId ? (
          <p className="muted" style={{ margin: 0, fontSize: '12px' }}>Agent RTC Actif: <strong style={{ color: 'var(--google-blue)' }}>{bank.bank.activeDraftId}</strong></p>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: '12px' }}>Aucun agent chargé en RTC pour le moment.</p>
        )}
      </section>

      {bank.message ? <p className="error" style={{ color: 'var(--google-red)', background: 'var(--google-red-light)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--google-red)', fontSize: '12px', marginBottom: '16px' }}>{bank.message}</p> : null}

      <section className="agent-grid" aria-busy={bank.loading}>
        {bank.loading ? (
          <Panel title="Chargement des Agents">
            <p className="muted">Lecture de l'état local du SDK...</p>
          </Panel>
        ) : bank.agents.length === 0 ? (
          <Panel title="Aucun Agent Trouvé">
            <p className="muted" style={{ textAlign: 'center', padding: '12px', margin: 0 }}>
              Compilez un agent ou enregistrez un brouillon pour commencer à remplir votre banque.
            </p>
          </Panel>
        ) : (
          bank.agents.map((agent) => (
            <AgentCard
              key={agent.draftId}
              agent={agent}
              busyDraftId={bank.busyDraftId}
              onLoadRtc={bank.loadInRtc}
              onResumeBuilder={bank.resumeDraft}
            />
          ))
        )}
      </section>
    </>
  );
}
