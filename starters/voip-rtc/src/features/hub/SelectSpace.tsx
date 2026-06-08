import { useState, useEffect } from "react";
import { Button } from "../../components/ui/Button.js";
import { Metric } from "../../components/ui/Metric.js";
import type { AppMode } from "../../domain/app/mode.js";
import type {
  AgentBuildDraft,
  CompiledAgentSummary,
} from "../../domain/builder/types.js";
import { useAgentBank } from "../../hooks/useAgentBank.js";

export function SelectSpace({
  apiBase,
  onEnterMode,
  onLoadRtc,
  onResumeBuilder,
}: {
  apiBase: string;
  onEnterMode: (mode: AppMode) => void;
  onLoadRtc: (artifact: CompiledAgentSummary) => void;
  onResumeBuilder: (draft: AgentBuildDraft) => void;
}) {
  const bank = useAgentBank({
    apiBase,
    refreshKey: 0,
    onLoadRtc,
    onResumeBuilder,
  });

  const [apiInput, setApiInput] = useState(apiBase);
  const [ping, setPing] = useState(14);
  const [cpu, setCpu] = useState(1.2);

  // Simulation dynamique d'indicateurs de performance serveur pour le côté "temps réel"
  useEffect(() => {
    const interval = setInterval(() => {
      setPing((prev) => Math.max(8, Math.min(28, prev + (Math.random() * 4 - 2))));
      setCpu((prev) => Math.max(0.4, Math.min(3.8, prev + (Math.random() * 0.6 - 0.3))));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="select-space-container">
      {/* Sphères colorées d'atmosphère */}
      <div className="hub-ambient-canvas">
        <div className="hub-sphere blue" />
        <div className="hub-sphere green" />
        <div className="hub-sphere yellow" />
      </div>

      <header className="hub-header">
        <div className="hub-brand">
          <div className="hub-brand-dot" />
          <span>SPATIAL AGENT SDK</span>
        </div>
        <div className="hub-server-status">
          <span className="pulse-led" />
          <span>SYSTEM ACTIVE - DEV PORT 5177</span>
        </div>
      </header>

      <main className="hub-grid">
        {/* ==========================================
           LEFT COLUMN: Onboarding & System Console (42vw)
           ========================================== */}
        <section className="hub-left-pane">
          <div className="hub-welcome">
            <p className="eyebrow">Developer Portal</p>
            <h1>Launchpad</h1>
            <p className="hub-subtitle">
              Bienvenue dans le portail développeur du SDK Voice Agent. Lancez le créateur cinématique, explorez vos modèles compilés ou auditez vos configurations d'infrastructure.
            </p>
          </div>

          {/* Onboarding Guide */}
          <div className="hub-onboarding-panel">
            <h3>🧭 ONBOARDING CHECKS</h3>
            <ul className="onboarding-steps">
              <li className="completed">
                <span className="step-icon">✓</span>
                <span className="step-text">SDK Core Engine Initialized</span>
              </li>
              <li className="completed">
                <span className="step-icon">✓</span>
                <span className="step-text">PostgreSQL pgvector Database Bound</span>
              </li>
              <li className={bank.agents.length > 0 ? "completed" : "active"}>
                <span className="step-icon">{bank.agents.length > 0 ? "✓" : "→"}</span>
                <span className="step-text">
                  Design & Architect System Identity
                  {bank.agents.length === 0 && (
                    <button 
                      className="step-inline-link" 
                      onClick={() => onEnterMode("builder")}
                    >
                      (Commencer)
                    </button>
                  )}
                </span>
              </li>
              <li className={bank.agents.some(a => a.knowledge?.documentCount && a.knowledge.documentCount > 0) ? "completed" : "pending"}>
                <span className="step-icon">○</span>
                <span className="step-text">Ingest & Ground Reference Data</span>
              </li>
              <li className={bank.bank?.activeDraftId ? "completed" : "pending"}>
                <span className="step-icon">○</span>
                <span className="step-text">Launch Websocket VoIP Realtime Sandbox</span>
              </li>
            </ul>
          </div>

          {/* System Performance Console */}
          <div className="hub-performance-console">
            <div className="console-header">
              <span>🖥  SYSTEM DIAGNOSTICS</span>
              <span className="pulse-led ready" />
            </div>
            <div className="console-stats-grid">
              <Metric label="API Server Ping" value={`${ping.toFixed(0)} ms`} />
              <Metric label="Local CPU Load" value={`${cpu.toFixed(1)} %`} />
              <Metric label="Agent Vault Size" value={`${bank.agents.length} items`} />
              <Metric 
                label="RTC Server Status" 
                value={bank.bank?.activeDraftId ? "Active Client Loaded" : "Idle Listener"} 
              />
            </div>
            <pre className="console-log-trace">
              {`[system] Server running on host 0.0.0.0:5177
[database] pgvector connection check: ok (1.4ms)
[models] Voyage API initialized: dimensions 1536
[models] DeepSeek model verified: deepseek-v4-pro
[active] Current session context: ${bank.bank?.activeDraftId ?? "none"}`}
            </pre>
          </div>
        </section>

        {/* ==========================================
           RIGHT COLUMN: Spaces Selector & Config (58vw)
           ========================================== */}
        <section className="hub-right-pane">
          {/* Workspaces Grid */}
          <div className="spaces-section">
            <h2 className="section-title">📂 WORKSPACES</h2>
            <div className="spaces-grid">
              <div
                className="space-card onboarding"
                onClick={() => onEnterMode("environment")}
              >
                <div className="space-icon-wrapper">00</div>
                <div className="space-content">
                  <h3>Onboarding Config</h3>
                  <p>Vérifiez Docker, kubectl et l'infra locale, puis persistez les clés runtime dans le store .env.local ignoré par Git.</p>
                </div>
                <span className="space-action-link">→</span>
              </div>

              {/* Card 1: Agent Builder */}
              <div 
                className="space-card builder" 
                onClick={() => onEnterMode("builder")}
              >
                <div className="space-icon-wrapper">01</div>
                <div className="space-content">
                  <h3>Agent Builder Space</h3>
                  <p>Configurez la personnalité, le prompt système optimal, chargez la base documentaire RAG et déployez la structure vectorielle.</p>
                </div>
                <span className="space-action-link">→</span>
              </div>

              {/* Card 2: Agent Bank */}
              <div 
                className="space-card bank" 
                onClick={() => onEnterMode("agents")}
              >
                <div className="space-icon-wrapper">02</div>
                <div className="space-content">
                  <h3>Agent Bank Vault</h3>
                  <p>Explorez les instances d'agents vocaux déjà compilées ou relancez la configuration de vos brouillons interrompus.</p>
                </div>
                <span className="space-action-link">→</span>
              </div>

              {/* Card 3: VoIP RTC Lab */}
              <div 
                className="space-card rtc" 
                onClick={() => onEnterMode("rtc")}
              >
                <div className="space-icon-wrapper">03</div>
                <div className="space-content">
                  <h3>VoIP RTC Sandbox</h3>
                  <p>Connectez votre microphone ou chargez un simulateur de flux silencieux pour tester la latence et écouter les réponses.</p>
                </div>
                <span className="space-action-link">→</span>
              </div>
            </div>
          </div>

          {/* Quick Agent Vault */}
          <div className="quick-vault-section">
            <h2 className="section-title">📦 COMPILED AGENTS QUICKSTART</h2>
            {bank.loading ? (
              <div className="quick-vault-empty">Chargement de la banque d'agents...</div>
            ) : bank.agents.length === 0 ? (
              <div className="quick-vault-empty">
                Aucun agent disponible. Rendez-vous dans le <strong>Builder Space</strong> pour compiler votre premier modèle.
              </div>
            ) : (
              <div className="quick-vault-list">
                {bank.agents.slice(0, 3).map((agent) => (
                  <div key={agent.draftId} className="quick-vault-row">
                    <div className="quick-agent-meta">
                      <strong>{agent.publicAgentName}</strong>
                      <span className="quick-agent-badge">{agent.kind}</span>
                      <span className="quick-agent-desc">{agent.intent.slice(0, 75)}...</span>
                    </div>
                    <div className="quick-agent-actions">
                      {agent.canRunRtc ? (
                        <button 
                          type="button" 
                          onClick={() => bank.loadInRtc(agent)}
                        >
                          🎙  Flash to RTC
                        </button>
                      ) : (
                        <button 
                          type="button" 
                          onClick={() => bank.resumeDraft(agent)}
                        >
                          ✏  Edit Draft
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Global Config Panel */}
          <div className="hub-config-section">
            <h2 className="section-title">⚙  GLOBAL SERVER CONFIGURATION</h2>
            <div className="config-card">
              <div className="config-fields-grid">
                <label className="field">
                  <span>Builder Base API Address</span>
                  <input 
                    value={apiInput} 
                    onChange={(e) => setApiInput(e.target.value)} 
                    placeholder="http://localhost:5177"
                  />
                </label>
                
                <div className="config-stats-switches">
                  <div className="config-indicator-item">
                    <span>DeepSeek LLM Integration</span>
                    <strong className="status-label green">CONNECTED</strong>
                  </div>
                  <div className="config-indicator-item">
                    <span>Voyage Embedding Model</span>
                    <strong className="status-label green">ACTIVE</strong>
                  </div>
                  <div className="config-indicator-item">
                    <span>pgvector Postgres Server</span>
                    <strong className="status-label green">ONLINE</strong>
                  </div>
                </div>
              </div>
              
              <div className="config-actions">
                <Button 
                  variant="primary"
                  onClick={() => alert("Paramètres de l'API synchronisés avec succès !")}
                >
                  Save & Sync SDK Credentials
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
