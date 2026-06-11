import { createAgentBuildDraftBuilder, type DatabaseBuildPlan, type EmbeddingInput } from "@voiceagentsdk/core/sdk";
import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { chunkDocuments } from "./domain/knowledge/plan.js";
import { promptPlanWithClarifications } from "./domain/prompt/plan.js";
import { mutateDraft } from "./domain/drafts/mutations.js";
import { normalizeBuilderSystem } from "./request/builder-system.js";
import { normalizeIdentity } from "./request/identity.js";
import { normalizeKnowledgeDocuments } from "./request/knowledge-documents.js";
import { normalizeResearchSettings } from "./request/research-settings.js";
import { normalizeResearchBudget } from "./domain/research/plan.js";
import { builderSystemDefaults } from "./default-builder-system.js";
import { saveDraft } from "./state/draft-store.js";
import {
  requireOwnedDraft,
  resolveOwnedDraft,
} from "./state/draft-ownership.js";
import { ownerMetadata } from "./state/draft-owner-scope.js";
import {
  activeAgentScopeFromContext,
  createGlobalActiveAgentAssignment,
} from "./state/active-agent-assignment.js";
import type { BuilderRequestContext, BuilderWorkflowDependencies } from "./types.js";
import { asRecord, readString } from "./utils/record-readers.js";
import { buildEagerKnowledge } from "./eager-knowledge.js";
import { compileAgentWithServerPolicy } from "./workflow-agent-compile.js";
import { ingestDocumentWithGuards } from "./workflow-document-ingestion.js";
import { createValidatedInfraPlan } from "./workflow-infra.js";

export function createBuilderWorkflows(deps: BuilderWorkflowDependencies) {
  return {
    async activateSession(body: unknown, context: BuilderRequestContext = {}) {
      const draftId = readString(body, "draftId");
      if (!draftId) throw new Error("draftId is required");
      const draft = requireOwnedDraft(draftId, context);
      if (!draft.compiled) throw new Error(`Draft "${draftId}" is not compiled`);
      await setActiveAgent(deps, draftId, context);
    },

    async createPromptPlan(body: unknown, context: BuilderRequestContext = {}) {
      const identity = normalizeIdentity(body);
      const builderSystem = normalizeBuilderSystem(body, builderSystemDefaults(deps));
      const draftId = readString(body, "draftId") || `draft_${crypto.randomUUID()}`;
      const draft = createAgentBuildDraftBuilder(draftId, identity)
        .builderSystem(builderSystem)
        .registry(deps.toolRegistry)
        .selectTools(
          deps.toolRegistry
            .filter((item) => item.selectedByDefault)
            .map((item) => item.name),
        )
        .build();

      const plan = await deps.planner.createPromptPlan({ draft });
      const nextDraft = createAgentBuildDraftBuilder(draft.id, draft.identity)
        .builderSystem(builderSystem)
        .registry(deps.toolRegistry)
        .selectTools(draft.selectedTools)
        .promptPlan(plan)
        .metadata(ownerMetadata(context.identity))
        .build();
      saveDraft(nextDraft);
      return { draft: nextDraft };
    },

    async savePromptClarifications(body: unknown, context: BuilderRequestContext = {}) {
      const draft = resolveOwnedDraft(body, context);
      if (!draft.promptPlan) throw new Error("Prompt plan is required");
      const answers = normalizePromptAnswers(body);
      const acceptUnanswered = asRecord(body).acceptUnanswered !== false;
      const plan = promptPlanWithClarifications(
        draft.promptPlan,
        answers,
        acceptUnanswered,
      );
      const nextDraft = mutateDraft(draft)
        .promptPlan(plan)
        .metadata({ promptClarifications: answers })
        .build();
      saveDraft(nextDraft);
      return { draft: nextDraft };
    },

    async ingestDocument(
      request: Request,
      context: BuilderRequestContext = {},
    ) {
      return ingestDocumentWithGuards({ context, deps, request });
    },

    async runResearch(body: unknown, context: BuilderRequestContext = {}) {
      const draft = resolveOwnedDraft(body, context);
      const documents = normalizeKnowledgeDocuments(body);
      const research = normalizeResearchSettings(body, researchDefaults(deps, draft));
      if (!deps.research.isConfigured(research)) {
        return {
          status: "blocked",
          reason: "Research provider not configured",
          requiredEnv: `${research.provider.toUpperCase()}_API_KEY`,
        };
      }
      const result = await deps.research.growKnowledge({
        draft,
        documents,
        budget: normalizeResearchBudget(body),
        settings: research,
      });
      return {
        status: result.status,
        documents: result.documents,
        document: result.documents[0],
        research: result,
      };
    },

    async buildAutonomousKnowledge(body: unknown, context: BuilderRequestContext = {}) {
      const draft = resolveOwnedDraft(body, context);
      const result = await buildEagerKnowledge({
        deps,
        draft,
        documents: normalizeKnowledgeDocuments(body),
        budget: normalizeResearchBudget(body),
        research: normalizeResearchSettings(
          body,
          researchDefaults(deps, draft),
        ),
      });
      return { status: result.draft.status, ...result };
    },

    async createKnowledgePlan(body: unknown, context: BuilderRequestContext = {}) {
      const draft = resolveOwnedDraft(body, context);
      const documents = normalizeKnowledgeDocuments(body);
      const plan = await deps.planner.createKnowledgePlan({ draft, documents });
      const nextDraft = mutateDraft(draft).knowledgePlan(plan).build();
      saveDraft(nextDraft);
      return { draft: nextDraft };
    },

    async createDatabasePlan(body: unknown, context: BuilderRequestContext = {}) {
      const draft = resolveOwnedDraft(body, context);
      const documents =
        draft.knowledgePlan?.documents.length
          ? draft.knowledgePlan.documents
          : normalizeKnowledgeDocuments(body);
      const plan = await deps.planner.createDatabasePlan({
        draft,
        documents,
        knowledgePlan: draft.knowledgePlan,
      });
      const validation = deps.databaseProvisioner.validate({ draft, plan });
      const nextPlan: DatabaseBuildPlan = {
        ...plan,
        status: validation.ok ? "validated" : "failed",
        validationErrors: validation.errors,
      };
      const infra = await createValidatedInfraPlan({
        databasePlan: nextPlan,
        deps,
        documents,
        draft,
        knowledgePlan: draft.knowledgePlan,
      });
      const nextDraft = mutateDraft(draft)
        .databasePlan(nextPlan)
        .infraPlan(infra.plan)
        .build();
      saveDraft(nextDraft);
      return { draft: nextDraft, infraValidation: infra.validation, validation };
    },

    async applyDatabase(body: unknown, context: BuilderRequestContext = {}) {
      const draft = resolveOwnedDraft(body, context);
      const plan = draft.databasePlan;
      if (!plan) throw new Error("Database plan is required before provisioning");
      if (!deps.databaseProvisioner.isConfigured()) {
        return {
          status: "blocked",
          reason: "Database provisioner not configured",
          requiredEnv: "DATABASE_URL",
        };
      }
      const validation = deps.databaseProvisioner.validate({ draft, plan });
      if (!validation.ok) {
        return { status: "blocked", reason: "SQL validation failed", validation };
      }
      const result = await deps.databaseProvisioner.apply({ draft, plan });
      const nextPlan: DatabaseBuildPlan = {
        ...plan,
        status: "applied",
        appliedAt: result.appliedAt,
        validationErrors: [],
      };
      const nextDraft = mutateDraft(draft)
        .databasePlan(nextPlan)
        .metadata({ databaseProvision: result })
        .build();
      saveDraft(nextDraft);
      return { status: "applied", result, draft: nextDraft };
    },

    async compileKnowledge(body: unknown, context: BuilderRequestContext = {}) {
      const draft = resolveOwnedDraft(body, context);
      if (!deps.knowledgeStore.isConfigured()) {
        return {
          status: "blocked",
          reason: "Knowledge store not configured",
          requiredEnv: "DATABASE_URL",
        };
      }
      if (!deps.voyageConfigured) {
        return {
          status: "blocked",
          reason: "Embedding provider not configured",
          requiredEnv: "VOYAGE_API_KEY",
        };
      }

      const plannedDocuments = draft.knowledgePlan?.documents ?? [];
      const documents = plannedDocuments.length
        ? plannedDocuments
        : normalizeKnowledgeDocuments(body);
      const chunks = chunkDocuments(documents, draft.knowledgePlan);
      const vectors = await deps.embeddings.embed(
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
        embeddings: vectors,
      });
      const nextDraft = mutateDraft(draft)
        .status("knowledge-compiled")
        .metadata({ knowledgeStore: result })
        .build();
      saveDraft(nextDraft);
      return { status: "compiled", result, draft: nextDraft };
    },

    async compileAgent(body: unknown, context: BuilderRequestContext = {}) {
      return compileAgentWithServerPolicy(body, deps, context);
    },
  };
}

async function setActiveAgent(
  deps: BuilderWorkflowDependencies,
  draftId: string,
  context: BuilderRequestContext,
): Promise<void> {
  const assignment = deps.activeAgentAssignment ?? createGlobalActiveAgentAssignment();
  await assignment.setActiveAgent({
    ...activeAgentScopeFromContext(context),
    draftId,
  });
}

function researchDefaults(
  deps: BuilderWorkflowDependencies,
  draft?: AgentBuildDraft,
) {
  const researcher = draft?.builderSystem?.modelSelections["builder.researcher"];
  const verifier = draft?.builderSystem?.modelSelections["builder.verifier"];
  return {
    provider: String(researcher?.provider ?? deps.researchProvider),
    model: researcher?.model ?? deps.researchModel,
    verifierProvider: String(
      verifier?.provider ?? deps.knowledgeVerificationProvider,
    ),
    verifierModel: verifier?.model ?? deps.knowledgeVerificationModel,
  };
}

function normalizePromptAnswers(body: unknown): Record<string, string> {
  const raw = asRecord(asRecord(body).answers);
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, (value as string).trim()])
      .filter(([, value]) => value.length > 0),
  );
}
