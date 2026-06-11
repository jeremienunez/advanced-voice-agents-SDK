import { useState } from "react";
import { compileAgentSpec } from "../api/builderApi.js";
import type {
  AgentBuildDraft,
  BuilderConfig,
  BuilderIdentity,
  BuilderResearchSettings,
  BuilderSystemConfig,
  BuilderSystemModelSelection,
  BuilderSystemRole,
  CompiledAgentSummary,
} from "../domain/builder/types.js";
import type {
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchResult,
} from "../domain/builder/knowledge.js";
import {
  defaultResearchBudget,
  emptyBuilderSystem,
  emptyIdentity,
} from "../domain/builder/defaults.js";
import { keepLoaderVisible } from "../domain/builder/progress.js";
import { deriveBuilderState } from "../domain/builder/derive-state.js";
import { useBuilderConfigBootstrap } from "./useBuilderConfigBootstrap.js";
import { useBuilderKnowledgeActions } from "./useBuilderKnowledgeActions.js";
import { useBuilderPromptPlanning } from "./useBuilderPromptPlanning.js";
import { useRestoredBuilderDraft } from "./useRestoredBuilderDraft.js";

export function useBuilderLab({
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
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [form, setForm] = useState<BuilderIdentity>(emptyIdentity);
  const [builderSystem, setBuilderSystem] =
    useState<BuilderSystemConfig>(emptyBuilderSystem);
  const [draft, setDraft] = useState<AgentBuildDraft | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [researchBudget, setResearchBudget] =
    useState<KnowledgeResearchBudget>(defaultResearchBudget);
  const [researchSettings, setResearchSettings] =
    useState<BuilderResearchSettings>({
      provider: "",
      model: "",
      verifierProvider: "",
      verifierModel: "",
      verificationPasses: 3,
    });
  const [researchReport, setResearchReport] =
    useState<KnowledgeResearchResult | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] =
    useState<CompiledAgentSummary | null>(null);

  useBuilderConfigBootstrap({
    apiBase,
    setConfig,
    setConfigError,
    setResearchBudget,
    setResearchSettings,
    setBuilderSystem,
    setSelectedTools,
  });
  useRestoredBuilderDraft({
    restoredDraft,
    onRestoredDraftConsumed,
    setDocuments,
    setDraft,
    setForm,
    setBuilderSystem,
    setMessage,
    setResearchReport,
    setSelectedTools,
  });

  const derived = deriveBuilderState({
    draft,
    documents,
    config,
    form,
    researchSettings,
    busy,
  });

  const updateField = (key: keyof BuilderIdentity, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateResearchBudget = (
    key: keyof KnowledgeResearchBudget,
    value: number,
  ) => {
    setResearchBudget((current) => ({ ...current, [key]: value }));
  };

  const updateResearchSettings = (patch: Partial<BuilderResearchSettings>) => {
    setResearchSettings((current) => ({ ...current, ...patch }));
  };

  const updateBuilderSystemSelection = (
    role: BuilderSystemRole,
    selection: BuilderSystemModelSelection,
  ) => {
    setBuilderSystem((current) => ({
      modelSelections: {
        ...current.modelSelections,
        [role]: selection,
        ...(role === "builder.planner"
          ? {
              "builder.prompt_composer": selection,
              "builder.database_planner": selection,
              "builder.tool_planner": selection,
            }
          : {}),
      },
    }));
    if (role === "builder.researcher") {
      updateResearchSettings({
        provider: selection.provider,
        model: selection.model,
      });
    }
    if (role === "builder.verifier") {
      updateResearchSettings({
        verifierProvider: selection.provider,
        verifierModel: selection.model,
      });
    }
  };

  const promptPlanning = useBuilderPromptPlanning({
    apiBase,
    builderSystem,
    form,
    draft,
    setDraft,
    setSelectedTools,
    setBusy,
    setMessage,
  });

  const knowledgeActions = useBuilderKnowledgeActions({
    apiBase,
    documents,
    draft,
    researchBudget,
    researchSettings,
    setBusy,
    setDocuments,
    setDraft,
    setMessage,
    setResearchReport,
  });

  async function compileAgent() {
    if (!draft) {
      setMessage("Create a draft before compiling the agent.");
      return;
    }
    if (draft.databasePlan?.status !== "applied") {
      setMessage("Apply the database plan before compiling the agent.");
      return;
    }
    const startedAt = performance.now();
    setBusy("compile-agent");
    setMessage(null);
    setCreatedAgent(null);
    try {
      const response = await compileAgentSpec(apiBase, draft, selectedTools);
      setDraft(response.draft);
      await keepLoaderVisible(startedAt, 900);
      setBusy(null);
      setCreatedAgent(response.artifact);
      window.setTimeout(() => {
        setCreatedAgent(null);
        onCompiled(response.artifact);
      }, 1900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Agent compile failed");
    } finally {
      setBusy(null);
    }
  }

  return {
    config,
    configError,
    builderSystem,
    form,
    draft,
    documents,
    researchBudget,
    researchSettings,
    researchReport,
    selectedTools,
    promptAnswers: promptPlanning.promptAnswers,
    message,
    busy,
    createdAgent,
    ...derived,
    updateField,
    updateBuilderSystemSelection,
    updateResearchBudget,
    updateResearchSettings,
    updatePromptAnswer: promptPlanning.updatePromptAnswer,
    setSelectedTools,
    analyzeIntent: promptPlanning.analyzeIntent,
    confirmPromptPlan: promptPlanning.confirmPromptPlan,
    ...knowledgeActions,
    compileAgent,
  };
}
