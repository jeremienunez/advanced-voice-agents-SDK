import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.js";
import { ProcessingLoader } from "../../components/ui/ProcessingLoader.js";
import type {
  AgentBuildDraft,
  CompiledAgentSummary,
} from "../../domain/builder.js";
import { useBuilderLab } from "../../hooks/useBuilderLab.js";
import { AgentCreatedOverlay } from "./components/AgentCreatedOverlay.js";
import { BuilderStatus } from "./components/BuilderStatus.js";
import { DatabaseInstancePanel } from "./components/DatabaseInstancePanel.js";
import { IdentityIntentPanel } from "./components/IdentityIntentPanel.js";
import { KnowledgeStrategyPanel } from "./components/KnowledgeStrategyPanel.js";
import { PromptPlanPanel } from "./components/PromptPlanPanel.js";
import { StepRail } from "./components/StepRail.js";
import { ToolRegistryPanel } from "./components/ToolRegistryPanel.js";

const STEP_TITLES = [
  "Establish the Core Identity",
  "Generate Core Blueprint",
  "Ingest & Strategize RAG Base",
  "Configure Postgres Vector",
  "Register Real-time System Tools",
  "Flash and Launch Agent",
];

const STEP_DESCRIPTIONS = [
  "Définissez le nom, le profil et l'intention principale de votre agent vocal pour structurer sa personnalité de départ.",
  "Synthétisez les contraintes et règles comportementales dans un prompt système déterministe optimisé par DeepSeek.",
  "Téléversez vos documents de référence (PDF, MD, TXT) ou lancez une recherche web autonome pour alimenter la base RAG.",
  "Planifiez et appliquez les schémas pgvector pour ancrer la mémoire à long terme de votre agent dans une base PostgreSQL.",
  "Associez des outils système, des requêtes API ou des fonctions tierces pour rendre votre agent autonome et orienté action.",
  "Compilez la structure finale de l'agent, établissez le canal WebSockets et ouvrez le playground de test temps réel.",
];

function WordsPullUp({ text, stepKey }: { text: string; stepKey: number }) {
  const words = text.split(" ");
  return (
    <h1 key={stepKey} className="words-pullup-container">
      {words.map((word, i) => (
        <span
          key={i}
          className="pullup-word"
          style={{ "--word-index": i } as React.CSSProperties}
        >
          {word}&nbsp;
        </span>
      ))}
    </h1>
  );
}

function RollingIndex({ activeStep }: { activeStep: number }) {
  const indices = ["01", "02", "03", "04", "05", "06"];
  return (
    <div className="rolling-index-viewport">
      <div
        className="rolling-index-strip"
        style={{ transform: `translateY(-${activeStep * 80}px)` }}
      >
        {indices.map((idx) => (
          <div key={idx} className="rolling-index-digit">
            {idx}
          </div>
        ))}
      </div>
    </div>
  );
}

function DeveloperConsole({
  draft,
  previewPrompt,
  selectedTools,
  busy,
}: {
  draft: AgentBuildDraft | null;
  previewPrompt: string;
  selectedTools: string[];
  busy: boolean;
}) {
  const buildState = {
    agent_id: draft?.id ?? "not_created",
    status: draft?.status ?? "idle",
    knowledge_strategy: draft?.knowledgePlan?.strategy ?? "none",
    knowledge_documents: draft?.knowledgePlan?.documents?.length ?? 0,
    database_status:
      draft?.databasePlan?.status === "applied" || draft?.databasePlan?.appliedAt
        ? "applied"
        : "pending",
    tools: selectedTools.length > 0 ? selectedTools : "none",
  };

  return (
    <div className="dev-console-wrapper">
      <div className="dev-console-half top-half">
        <div className="console-header">
          <span>📊 BUILD STATE</span>
          <span className={`pulse-led ${busy ? "busy" : "ready"}`} />
        </div>
        <pre className="console-code">{JSON.stringify(buildState, null, 2)}</pre>
      </div>
      <div className="dev-console-half bottom-half">
        <div className="console-header">
          <span>📝 LIVE PROMPT CONSOLE</span>
        </div>
        <pre className="console-code prompt-code">{previewPrompt || "Compiling prompt..."}</pre>
      </div>
    </div>
  );
}

export function BuilderLab({
  apiBase,
  restoredDraft,
  onRestoredDraftConsumed,
  onCompiled,
}: {
  apiBase: string;
  restoredDraft: AgentBuildDraft | null;
  onRestoredDraftConsumed: () => void;
  onCompiled: (artifact: CompiledAgentSummary) => void;
}) {
  const builder = useBuilderLab({
    apiBase,
    restoredDraft,
    onRestoredDraftConsumed,
    onCompiled,
  });

  const [currentStep, setCurrentStep] = useState(0);

  // Synchronisation automatique de l'étape active lorsque le serveur avance
  useEffect(() => {
    setCurrentStep((prev) => Math.max(prev, builder.activeStep));
  }, [builder.activeStep]);

  const busy = Boolean(builder.busy);
  const handleNext = useCallback(async () => {
    if (currentStep === 1) {
      const confirmed = await builder.confirmPromptPlan();
      if (!confirmed) return;
    }
    setCurrentStep((curr) => Math.min(curr + 1, builder.unlockedStep));
  }, [builder, currentStep]);

  return (
    <div className="immersive-wizard-container">
      {/* ==========================================
         LEFT COLUMN: Storytelling and Double Console
         ========================================== */}
      <section className="immersive-left-pane">
        <div className="ambient-glow-canvas">
          <div className="ambient-sphere blue" />
          <div className="ambient-sphere green" />
          <div className="ambient-sphere yellow" />
        </div>

        <div className="left-header">
          <div className="left-brand-dot" />
          <span>SPATIAL AGENT SDK</span>
        </div>

        <div>
          <RollingIndex activeStep={currentStep} />
          <WordsPullUp text={STEP_TITLES[currentStep]} stepKey={currentStep} />
          <p className="step-description-text">{STEP_DESCRIPTIONS[currentStep]}</p>
        </div>

        <DeveloperConsole
          draft={builder.draft}
          previewPrompt={builder.previewPrompt}
          selectedTools={builder.selectedTools}
          busy={busy}
        />
      </section>

      {/* ==========================================
         RIGHT COLUMN: Form Panels
         ========================================== */}
      <section className="immersive-right-pane" aria-busy={busy}>
        {builder.busyState ? <ProcessingLoader state={builder.busyState} /> : null}
        {builder.createdAgent ? (
          <AgentCreatedOverlay
            artifact={builder.createdAgent}
            publicAgentName={builder.draft?.identity.publicAgentName ?? "Voice agent"}
          />
        ) : null}
        {builder.configError ? (
          <p className="error">{builder.configError}</p>
        ) : null}

        <div className="fade-in" key={currentStep}>
          {currentStep === 0 && (
            <IdentityIntentPanel
              form={builder.form}
              config={builder.config}
              busy={builder.busy}
              canAnalyze={builder.canAnalyze}
              updateField={builder.updateField}
              analyzeIntent={builder.analyzeIntent}
            />
          )}

          {currentStep === 1 && (
            <PromptPlanPanel
              draft={builder.draft}
              answers={builder.promptAnswers}
              busy={builder.busy}
              updateAnswer={builder.updatePromptAnswer}
              confirmPromptPlan={builder.confirmPromptPlan}
            />
          )}

          {currentStep === 2 && (
            <KnowledgeStrategyPanel
              draft={builder.draft}
              documents={builder.documents}
              researchBudget={builder.researchBudget}
              researchReport={builder.researchReport}
              researchSettings={builder.researchSettings}
              config={builder.config}
              busy={builder.busy}
              canRunResearch={builder.canRunResearch}
              canPlanKnowledge={builder.canPlanKnowledge}
              knowledgeBlocked={builder.knowledgeBlocked}
              researchBlocked={builder.researchBlocked}
              databaseReady={builder.databaseReady}
              updateResearchBudget={builder.updateResearchBudget}
              updateResearchSettings={builder.updateResearchSettings}
              handleDocumentUpload={builder.handleDocumentUpload}
              buildKnowledgeEagerly={builder.buildKnowledgeEagerly}
              runResearch={builder.runResearch}
              planKnowledge={builder.planKnowledge}
              compileKnowledge={builder.compileKnowledge}
            />
          )}

          {currentStep === 3 && (
            <DatabaseInstancePanel
              draft={builder.draft}
              busy={builder.busy}
              databaseBlocked={builder.databaseBlocked}
              canPlanDatabase={builder.canPlanDatabase}
              canApplyDatabase={builder.canApplyDatabase}
              planDatabase={builder.planDatabase}
              applyDatabase={builder.applyDatabase}
            />
          )}

          {(currentStep === 4 || currentStep === 5) && (
            <ToolRegistryPanel
              draft={builder.draft}
              toolRegistry={builder.toolRegistry}
              selectedTools={builder.selectedTools}
              busy={builder.busy}
              setSelectedTools={builder.setSelectedTools}
              compileAgent={builder.compileAgent}
            />
          )}
        </div>

        {builder.message ? <p className="error">{builder.message}</p> : null}
      </section>

      {/* ==========================================
         BOTTOM BAR: Symmetrical Timeline & Controls
         ========================================== */}
      <footer className="fixed-control-base">
        <Button
          className="back-btn"
          disabled={currentStep === 0 || busy}
          type="button"
          onClick={() => setCurrentStep((curr) => curr - 1)}
        >
          ← Retour
        </Button>

        <StepRail
          active={currentStep}
          unlocked={builder.unlockedStep}
          onStepClick={setCurrentStep}
        />

        <Button
          className="next-btn"
          disabled={currentStep >= builder.unlockedStep || busy}
          variant="primary"
          type="button"
          onClick={() => void handleNext()}
        >
          Continuer →
        </Button>
      </footer>
    </div>
  );
}
