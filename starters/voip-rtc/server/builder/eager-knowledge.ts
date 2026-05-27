import type {
  AgentBuildDraft,
  DatabaseBuildPlan,
  EmbeddingInput,
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchResult,
  KnowledgeVerificationVerdict,
} from "@voiceagentsdk/core/sdk";
import { chunkDocuments } from "./domain/knowledge.js";
import { mutateDraft } from "./domain/drafts.js";
import { saveDraft } from "./state.js";
import { runTeacherVerification } from "./teacher-verification.js";
import type {
  BuilderWorkflowDependencies,
} from "./types.js";
import { createValidatedInfraPlan } from "./workflow-infra.js";

export interface EagerKnowledgeInput {
  budget: Partial<KnowledgeResearchBudget>;
  deps: BuilderWorkflowDependencies;
  documents: KnowledgeDocument[];
  draft: AgentBuildDraft;
  research: { provider?: string; model?: string };
}

export async function buildEagerKnowledge(input: EagerKnowledgeInput) {
  const steps: Array<{ name: string; status: string; detail?: string }> = [];
  let draft = input.draft;
  let documents = [...input.documents];
  let research: KnowledgeResearchResult | undefined;
  let verification: KnowledgeVerificationVerdict[] = [];

  if (input.deps.research.isConfigured(input.research)) {
    research = await input.deps.research.growKnowledge({
      draft,
      documents,
      budget: input.budget,
      settings: input.research,
    });
    documents = [...documents, ...research.documents];
    steps.push({
      name: "research",
      status: research.status,
      detail: research.stopReason,
    });
    draft = mutateDraft(draft).metadata({ research }).build();
    saveDraft(draft);
  } else {
    steps.push({ name: "research", status: "blocked" });
  }

  if (documents.length === 0) {
    throw new Error("No knowledge documents available after autonomous research");
  }

  const teacher = await runTeacherVerification({
    budget: input.budget,
    deps: input.deps,
    documents,
    draft,
    research,
    researchSettings: input.research,
  });
  documents = teacher.documents;
  research = teacher.research;
  verification = teacher.verdicts;
  steps.push(...teacher.steps);
  if (verification.length > 0) {
    draft = mutateDraft(draft).metadata({ research, verification }).build();
    saveDraft(draft);
  }

  const knowledgePlan = await input.deps.planner.createKnowledgePlan({
    draft,
    documents,
  });
  draft = mutateDraft(draft).knowledgePlan(knowledgePlan).build();
  saveDraft(draft);
  steps.push({ name: "knowledge-plan", status: "completed" });

  const databasePlan = await input.deps.planner.createDatabasePlan({
    draft,
    documents: knowledgePlan.documents,
    knowledgePlan,
  });
  const validation = input.deps.databaseProvisioner.validate({
    draft,
    plan: databasePlan,
  });
  const validatedPlan: DatabaseBuildPlan = {
    ...databasePlan,
    status: validation.ok ? "validated" : "failed",
    validationErrors: validation.errors,
  };
  const infra = await createValidatedInfraPlan({
    databasePlan: validatedPlan,
    deps: input.deps,
    documents: knowledgePlan.documents,
    draft,
    knowledgePlan,
  });
  draft = mutateDraft(draft)
    .databasePlan(validatedPlan)
    .infraPlan(infra.plan)
    .build();
  saveDraft(draft);
  steps.push({ name: "database-plan", status: validatedPlan.status });
  steps.push({ name: "infra-plan", status: infra.plan.status });

  if (validation.ok && input.deps.databaseProvisioner.isConfigured()) {
    const provision = await input.deps.databaseProvisioner.apply({
      draft,
      plan: validatedPlan,
    });
    const appliedPlan: DatabaseBuildPlan = {
      ...validatedPlan,
      status: "applied",
      appliedAt: provision.appliedAt,
      validationErrors: [],
    };
    draft = mutateDraft(draft)
      .databasePlan(appliedPlan)
      .metadata({ databaseProvision: provision })
      .build();
    saveDraft(draft);
    steps.push({ name: "database-apply", status: "applied" });
  } else {
    steps.push({ name: "database-apply", status: "blocked" });
  }

  if (
    draft.databasePlan?.status === "applied" &&
    input.deps.knowledgeStore.isConfigured() &&
    input.deps.voyageConfigured
  ) {
    const compileResult = await compileKnowledge(input.deps, draft);
    draft = compileResult.draft;
    steps.push({
      name: "compile-knowledge",
      status: "compiled",
      detail: `${compileResult.result.chunkCount} chunks`,
    });
  } else {
    steps.push({ name: "compile-knowledge", status: "blocked" });
  }

  return { draft, documents, research, steps, verification };
}

async function compileKnowledge(
  deps: BuilderWorkflowDependencies,
  draft: AgentBuildDraft,
) {
  const documents = draft.knowledgePlan?.documents ?? [];
  const chunks = chunkDocuments(documents, draft.knowledgePlan);
  const embeddings = await deps.embeddings.embed(
    chunks.map((chunk): EmbeddingInput => ({
      id: chunk.id,
      text: chunk.text,
      metadata: {
        documentId: chunk.documentId,
        ordinal: chunk.ordinal,
      },
    })),
  );
  const result = await deps.knowledgeStore.compile({
    draft,
    documents,
    chunks,
    embeddings,
  });
  const nextDraft = mutateDraft(draft)
    .status("knowledge-compiled")
    .metadata({ knowledgeStore: result })
    .build();
  saveDraft(nextDraft);
  return { draft: nextDraft, result };
}
