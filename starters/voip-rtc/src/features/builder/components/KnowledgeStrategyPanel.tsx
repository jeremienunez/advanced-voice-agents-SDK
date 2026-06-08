import type { ChangeEvent } from "react";
import "../styles/components/KnowledgeStrategyPanel.css";
import { Panel } from "../../../components/ui/Panel.js";
import type {
  AgentBuildDraft,
  BuilderConfig,
  BuilderResearchSettings,
} from "../../../domain/builder/types.js";
import type {
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchResult,
} from "../../../domain/builder/knowledge.js";
import { diagnoseBuilderTrajectory } from "../../../domain/builder/agent-rx.js";
import { AgentRxPanel } from "./diagnostics/AgentRxPanel.js";
import { DocumentList } from "./knowledge/DocumentList.js";
import { KnowledgeActionBar } from "./knowledge/KnowledgeActionBar.js";
import { KnowledgePlanSummary } from "./knowledge/KnowledgePlanSummary.js";
import { KnowledgeWarnings } from "./knowledge/KnowledgeWarnings.js";
import { ResearchBudgetFields } from "./knowledge/ResearchBudgetFields.js";
import { ResearchProviderFields } from "./knowledge/ResearchProviderFields.js";
import { ResearchReportSummary } from "./knowledge/ResearchReportSummary.js";

export function KnowledgeStrategyPanel({
  apiBase,
  draft,
  documents,
  researchBudget,
  researchReport,
  researchSettings,
  config,
  busy,
  canRunResearch,
  canPlanKnowledge,
  knowledgeBlocked,
  researchBlocked,
  databaseReady,
  updateResearchBudget,
  updateResearchSettings,
  handleDocumentUpload,
  buildKnowledgeEagerly,
  runResearch,
  planKnowledge,
  compileKnowledge,
}: {
  apiBase: string;
  draft: AgentBuildDraft | null;
  documents: KnowledgeDocument[];
  researchBudget: KnowledgeResearchBudget;
  researchReport: KnowledgeResearchResult | null;
  researchSettings: BuilderResearchSettings;
  config: BuilderConfig | null;
  busy: string | null;
  canRunResearch: boolean;
  canPlanKnowledge: boolean;
  knowledgeBlocked: boolean;
  researchBlocked: boolean;
  databaseReady: boolean;
  updateResearchBudget: (key: keyof KnowledgeResearchBudget, value: number) => void;
  updateResearchSettings: (patch: Partial<BuilderResearchSettings>) => void;
  handleDocumentUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  buildKnowledgeEagerly: () => Promise<void>;
  runResearch: () => Promise<void>;
  planKnowledge: () => Promise<void>;
  compileKnowledge: () => Promise<void>;
}) {
  const diagnosticReport = diagnoseBuilderTrajectory({
    draft,
    documents,
    researchReport,
    knowledgeBlocked,
    researchBlocked,
    databaseReady,
  });

  return (
    <Panel title="2. Stratégie de Base de Connaissances RAG">
      <div className="knowledge-intro">
        Configurez les données de votre agent. Téléversez des documents de référence (PDF, MD, TXT, Excel) ou lancez une recherche web autonome, puis configurez le découpage (chunking) et compilez la base vectorielle pgvector.
      </div>
      <ResearchBudgetFields
        budget={researchBudget}
        updateResearchBudget={updateResearchBudget}
      />
      <ResearchProviderFields
        config={config}
        settings={researchSettings}
        updateResearchSettings={updateResearchSettings}
      />
      <KnowledgeActionBar
        busy={busy}
        canPlanKnowledge={canPlanKnowledge}
        canRunResearch={canRunResearch}
        buildKnowledgeEagerly={buildKnowledgeEagerly}
        compileKnowledge={compileKnowledge}
        databaseReady={databaseReady}
        draft={draft}
        handleDocumentUpload={handleDocumentUpload}
        knowledgeBlocked={knowledgeBlocked}
        planKnowledge={planKnowledge}
        runResearch={runResearch}
      />
      <KnowledgeWarnings
        databaseReady={databaseReady}
        draft={draft}
        knowledgeBlocked={knowledgeBlocked}
        researchBlocked={researchBlocked}
      />
      <AgentRxPanel report={diagnosticReport} />
      {researchReport ? <ResearchReportSummary report={researchReport} /> : null}
      <DocumentList
        apiBase={apiBase}
        documents={documents}
        draftId={draft?.id}
      />
      {draft?.knowledgePlan ? <KnowledgePlanSummary draft={draft} /> : null}
    </Panel>
  );
}
