import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.js";
import { ProcessingLoader } from "../../components/ui/ProcessingLoader.js";
import type {
  AgentBuildDraft,
  CompiledAgentSummary,
} from "../../domain/builder/types.js";
import { useBuilderLab } from "../../hooks/useBuilderLab.js";
import { AgentCreatedOverlay } from "./components/AgentCreatedOverlay.js";
import { DatabaseInstancePanel } from "./components/DatabaseInstancePanel.js";
import { IdentityIntentPanel } from "./components/IdentityIntentPanel.js";
import { KnowledgeStrategyPanel } from "./components/KnowledgeStrategyPanel.js";
import { PromptPlanPanel } from "./components/PromptPlanPanel.js";
import { StepRail } from "./components/StepRail.js";
import { ToolRegistryPanel } from "./components/ToolRegistryPanel.js";

const STEP_TITLES = [
  "Identity",
  "Prompt Blueprint",
  "Knowledge",
  "Database",
  "Tools",
  "Compile",
];

const STEP_DESCRIPTIONS = [
  "Define the public name, builder profile, and core voice-agent intent.",
  "Review behavior rules, uncertainty policy, voice tone, and prompt assumptions.",
  "Upload or research reference material and prepare the retrieval strategy.",
  "Plan and apply the isolated Postgres/pgvector runtime store.",
  "Select runtime tools, permissions, side effects, confirmations, and handlers.",
  "Compile the final artifact and make it available for RTC testing.",
];

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
  const promptNeedsConfirmation = Boolean(builder.draft?.promptPlan?.questions.length);
  const handleStepNavigation = useCallback(async (targetStep: number) => {
    if (busy || targetStep < 0 || targetStep > builder.unlockedStep) {
      return;
    }
    if (targetStep === currentStep) {
      return;
    }
    if (targetStep > 1 && promptNeedsConfirmation) {
      const confirmed = await builder.confirmPromptPlan();
      if (!confirmed) return;
    }
    setCurrentStep(targetStep);
  }, [builder, busy, currentStep, promptNeedsConfirmation]);

  return (
    <section className="builderStudio fade-in" aria-busy={busy}>
      {builder.busyState ? <ProcessingLoader state={builder.busyState} /> : null}
      {builder.createdAgent ? (
        <AgentCreatedOverlay
          artifact={builder.createdAgent}
          publicAgentName={builder.draft?.identity.publicAgentName ?? "Voice agent"}
        />
      ) : null}

      <aside className="builderPath">
        <div>
          <p className="studioEyebrow">Guided build</p>
          <h2>Build path</h2>
        </div>
        <StepRail
          active={currentStep}
          unlocked={builder.unlockedStep}
          onStepClick={(step) => void handleStepNavigation(step)}
        />
      </aside>

      <main className="builderStepPanel">
        <header className="builderStepHeader">
          <div>
            <p className="studioEyebrow">
              Step {currentStep + 1} of {STEP_TITLES.length}
            </p>
            <h1>{STEP_TITLES[currentStep]}</h1>
            <p>{STEP_DESCRIPTIONS[currentStep]}</p>
          </div>
          <div className="builderStepActions">
            <Button
              disabled={currentStep === 0 || busy}
              type="button"
              onClick={() => void handleStepNavigation(currentStep - 1)}
            >
              Previous
            </Button>
            <Button
              disabled={currentStep >= builder.unlockedStep || busy}
              variant="primary"
              type="button"
              onClick={() => void handleStepNavigation(currentStep + 1)}
            >
              Continue
            </Button>
          </div>
        </header>

        {builder.configError ? <p className="error">{builder.configError}</p> : null}
        {builder.message ? <p className="error">{builder.message}</p> : null}

        <div className="builderStepContent" key={currentStep}>
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
              apiBase={apiBase}
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
              canCompile={builder.unlockedStep >= 5 && builder.databaseReady}
              setSelectedTools={builder.setSelectedTools}
              compileAgent={builder.compileAgent}
            />
          )}
        </div>
      </main>

      <aside className="builderInspector">
        <section className="builderInspectorPanel">
          <h2>Advanced modules</h2>
          <button type="button" disabled={busy || builder.unlockedStep < 0} onClick={() => void handleStepNavigation(0)}>Identity</button>
          <button type="button" disabled={busy || builder.unlockedStep < 1} onClick={() => void handleStepNavigation(1)}>Prompt</button>
          <button type="button" disabled={busy || builder.unlockedStep < 2} onClick={() => void handleStepNavigation(2)}>Knowledge</button>
          <button type="button" disabled={busy || builder.unlockedStep < 3} onClick={() => void handleStepNavigation(3)}>Database</button>
          <button type="button" disabled={busy || builder.unlockedStep < 4} onClick={() => void handleStepNavigation(4)}>Tools</button>
        </section>
        <section className="builderInspectorPanel">
          <h2>Live preview</h2>
          <dl className="builderPreviewList">
            <div><dt>Agent</dt><dd>{builder.draft?.identity.publicAgentName ?? "Not created"}</dd></div>
            <div><dt>Status</dt><dd>{builder.draft?.status ?? "Idle"}</dd></div>
            <div><dt>Documents</dt><dd>{builder.documents.length}</dd></div>
            <div><dt>Tools</dt><dd>{builder.selectedTools.length}</dd></div>
          </dl>
        </section>
      </aside>
    </section>
  );
}
