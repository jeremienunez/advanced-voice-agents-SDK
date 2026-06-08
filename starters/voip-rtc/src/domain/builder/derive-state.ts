import type {
  AgentBuildDraft,
  BuilderConfig,
  BuilderIdentity,
  BuilderResearchSettings,
} from "./types.js";
import type { KnowledgeDocument } from "./knowledge.js";
import {
  getBusyState,
  resolveBuilderStep,
  resolveUnlockedBuilderStep,
} from "./progress.js";

export function deriveBuilderState({
  draft,
  documents,
  config,
  form,
  researchSettings,
  busy,
}: {
  draft: AgentBuildDraft | null;
  documents: KnowledgeDocument[];
  config: BuilderConfig | null;
  form: BuilderIdentity;
  researchSettings?: BuilderResearchSettings;
  busy: string | null;
}) {
  const researchProvider = config?.providers.research.find((provider) => {
    return provider.id === researchSettings?.provider;
  });
  const researchBlocked = config
    ? !(researchProvider?.configured ?? config.availability.research)
    : true;
  const databaseBlocked = config ? !config.availability.databaseProvisioner : true;

  return {
    toolRegistry: draft?.toolRegistry ?? config?.toolRegistry ?? [],
    activeStep: resolveBuilderStep(draft, documents.length),
    unlockedStep: resolveUnlockedBuilderStep(draft, documents.length),
    busyState: busy ? getBusyState(busy) : null,
    previewPrompt:
      draft?.promptParts.final ??
      draft?.promptParts.part1 ??
      "Run the first form to generate prompt part 1.",
    canAnalyze:
      form.builderFirstName.trim().length > 0 &&
      form.builderLastName.trim().length > 0 &&
      form.publicAgentName.trim().length > 0 &&
      form.intent.trim().length > 0,
    canPlanKnowledge: Boolean(draft) && documents.length > 0,
    knowledgeBlocked: config ? !config.availability.knowledgeStore : true,
    databaseBlocked,
    researchBlocked,
    canPlanDatabase: Boolean(draft?.knowledgePlan),
    canRunResearch: Boolean(draft?.promptPlan) && !researchBlocked,
    canApplyDatabase:
      Boolean(draft?.databasePlan) &&
      draft?.databasePlan?.status !== "applied" &&
      !databaseBlocked,
    databaseReady: draft?.databasePlan?.status === "applied",
  };
}
