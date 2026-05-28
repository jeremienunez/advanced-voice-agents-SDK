import { Button } from "../../../components/ui/Button.js";
import { Metric } from "../../../components/ui/Metric.js";
import { Panel } from "../../../components/ui/Panel.js";
import type { AgentBuildDraft } from "../../../domain/builder.js";
import type { AgentLearningStoreBackendPlan } from "../../../domain/builder-infra.js";
import "./DatabaseInstancePanel.css";

export function DatabaseInstancePanel({
  draft,
  busy,
  databaseBlocked,
  canPlanDatabase,
  canApplyDatabase,
  planDatabase,
  applyDatabase,
}: {
  draft: AgentBuildDraft | null;
  busy: string | null;
  databaseBlocked: boolean;
  canPlanDatabase: boolean;
  canApplyDatabase: boolean;
  planDatabase: () => Promise<void>;
  applyDatabase: () => Promise<void>;
}) {
  return (
    <Panel title="3. Instance de Base de Données pgvector">
      <div style={{ marginBottom: '20px', color: 'var(--slate-500)', fontSize: '13px', lineHeight: '1.5' }}>
        Configurez et provisionnez l'instance SQL isolée. Le système générera le schéma de table, les index de recherche vectoriels et lexicals, ainsi que les scripts de migration requis pour accueillir les connaissances de l'agent.
      </div>

      <div className="uploadRow">
        <Button
          onClick={() => void planDatabase()}
          disabled={!canPlanDatabase || Boolean(busy)}
        >
          {busy === "database-plan" ? "Planification du schéma..." : "Générer le schéma SQL"}
        </Button>
        
        <Button
          onClick={() => void applyDatabase()}
          disabled={!canApplyDatabase || Boolean(busy)}
          variant="primary"
        >
          {busy === "database-apply" ? "Création en cours..." : "Provisionner pgvector SQL"}
        </Button>
      </div>

      {databaseBlocked ? (
        <p className="warning" style={{ color: 'var(--google-red)', background: 'var(--google-red-light)', borderLeft: '3px solid var(--google-red)' }}>
          Le provisionneur de base de données n'est pas configuré. Veuillez démarrer l'instance locale (`npm run db:start`) ou configurer la variable DATABASE_URL.
        </p>
      ) : null}

      {draft?.databasePlan ? (
        <div className="databasePlan" style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--slate-900)', marginBottom: '14px', letterSpacing: '0.8px' }}>
            Spécifications de la Base
          </h3>
          <div className="strategySummary">
            <Metric label="Nom du Schéma" value={draft.databasePlan.schemaName} />
            <Metric label="Statut de Déploiement" value={draft.databasePlan.status} />
            <Metric
              label="Modèle Vectoriel"
              value={`${draft.databasePlan.vectorization.embeddingModel}, ${draft.databasePlan.vectorization.dimensions} dimensions`}
            />
            <Metric
              label="Mode de Recherche"
              value={`${draft.databasePlan.vectorization.retrievalMode} / ${draft.databasePlan.vectorization.index.kind}`}
            />
          </div>

          {draft.infraPlan ? (
            <div className="infraPlan">
              <h4 style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Plan Infra Agent
              </h4>
              <div className="strategySummary">
                <Metric label="Compute" value={draft.infraPlan.computeTarget} />
                <Metric label="Isolation" value={draft.infraPlan.isolation} />
                <Metric label="Provisioning" value={draft.infraPlan.provisioningMode} />
                <Metric label="Backend par Défaut" value={draft.infraPlan.defaultBackendId} />
              </div>
              <div className="infraBackendList">
                {draft.infraPlan.knowledgeBackends.map((backend) => (
                  <div key={backend.id} className="infraBackend">
                    <div className="backendHeader">
                      <strong>{backend.provider}</strong>
                      <span className="backendRole">{backend.role}</span>
                      <span className={`pill ${backend.configured ? "ok" : "warning"}`}>
                        {backend.configured ? "configuré" : "à configurer"}
                      </span>
                    </div>
                    {backend.capabilities && backend.capabilities.length > 0 && (
                      <div className="capabilityChips">
                        {backend.capabilities.map((cap) => (
                          <span key={cap} className="capabilityChip">{cap}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {draft.infraPlan.iac ? (
                <div className="iacBundle">
                  <strong>IaC</strong>
                  <span>{draft.infraPlan.iac.target}</span>
                  <span>{draft.infraPlan.iac.artifacts.length} artefacts</span>
                  <code>{draft.infraPlan.iac.artifacts[0]?.path}</code>
                </div>
              ) : null}
              {draft.infraPlan.storePlan ? (
                <div className="learningStores">
                  <h4 style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Learning Stores
                  </h4>
                  <div className="infraBackendList">
                    {[
                      draft.infraPlan.storePlan.temporalWorkflow,
                      draft.infraPlan.storePlan.temporalMemory,
                      draft.infraPlan.storePlan.graphMemory,
                      draft.infraPlan.storePlan.auditStore,
                      draft.infraPlan.storePlan.vectorBackend,
                    ].filter(isLearningStore).map((store) => (
                      <div key={store.id} className="infraBackend">
                        <div className="backendHeader">
                          <strong>{store.provider}</strong>
                          <span className="backendRole">{store.kind}</span>
                          <span className={`pill ${store.configured ? "ok" : store.required ? "warning" : "muted"}`}>
                            {store.configured ? "configuré" : store.required ? "requis" : "optionnel"}
                          </span>
                        </div>
                        {store.capabilities && store.capabilities.length > 0 && (
                          <div className="capabilityChips">
                            {store.capabilities.map((cap) => (
                              <span key={cap} className="capabilityChip">{cap}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p>
                    Création à la fin de session · scopes {draft.infraPlan.storePlan.scopes.join(" + ")} · rollback versionné.
                  </p>
                </div>
              ) : null}
              {draft.infraPlan.warnings?.length ? (
                <div className="infraWarnings">
                  {draft.infraPlan.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Database visual schema card */}
          <div className="db-schema-card">
            <h4 style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Schéma de Table Généré (pgvector)
            </h4>
            <div className="db-schema-grid">
              <div className="db-schema-column blue">
                <span style={{ color: 'var(--slate-500)', fontWeight: 700 }}>Colonne</span>: <code style={{ color: 'var(--slate-900)' }}>embedding</code><br/>
                <span style={{ color: 'var(--slate-500)', fontWeight: 700 }}>Type</span>: <code style={{ color: 'var(--google-blue)' }}>vector({draft.databasePlan.vectorization.dimensions})</code>
              </div>
              <div className="db-schema-column green">
                <span style={{ color: 'var(--slate-500)', fontWeight: 700 }}>Index</span>: <code style={{ color: 'var(--slate-900)' }}>HNSW</code><br/>
                <span style={{ color: 'var(--slate-500)', fontWeight: 700 }}>Distance</span>: <code style={{ color: 'var(--google-green)' }}>Cosine</code>
              </div>
            </div>
          </div>

          <div className="stack" style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.8px' }}>
              Migration SQL Automatique
            </h3>
            <pre className="sqlPreview">
              {draft.databasePlan.sqlMigration}
            </pre>
          </div>

          {draft.databasePlan.validationErrors?.length ? (
            <div className="stack" style={{ marginTop: '16px' }}>
              <h3 style={{ color: 'var(--google-red)' }}>Erreurs de Validation SQL</h3>
              {draft.databasePlan.validationErrors.map((error) => (
                <p key={error} className="error-box">
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="muted" style={{ padding: '32px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px dashed var(--slate-300)', borderRadius: 'var(--radius-lg)', color: 'var(--slate-500)', fontSize: '13px' }}>
          Le schéma SQL isolé, les index de recherche ainsi que les scripts de migration pgvector seront planifiés automatiquement après validation de l'étape de stratégie de connaissances.
        </p>
      )}
    </Panel>
  );
}

function isLearningStore(
  store: AgentLearningStoreBackendPlan | undefined,
): store is AgentLearningStoreBackendPlan {
  return Boolean(store);
}
